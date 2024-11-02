#!/usr/bin/env python
# coding:utf-8

BROKER = 'binance'
uri = "wss://stream.binance.com:9443/ws"

from os import name as osName, getpid as osGetpid
from datetime import datetime
from os.path import dirname as osPathDirname, join as osPathJoin
from json import dumps as jsonDumps, loads as jsonLoads
from asyncio import run as asyncioRun, set_event_loop_policy as asyncioSet_event_loop_policy, \
                    sleep as asyncioSleep, get_running_loop as asyncioGet_running_loop
import websockets
from sqlite3 import connect as sqlite3Connect

if osName != 'nt':
    import uvloop
    asyncioSet_event_loop_policy(uvloop.EventLoopPolicy())


# relative import
from sys import path;path.extend("..")
from common.config import Config
from common.Helpers.os_helpers import is_process_running
from common.Helpers.helpers import init_logger, getSplitedParam, standardStr, default_arguments
from common.Helpers.network_helpers import MyAsyncSocketObj
from common.Helpers.retrye import asyncRetry


LOG_LEVEL = 20
DEFAULT_MODE = "OneBrokerLight" 
SPECIFIC_ARGS = ["--mode", "--tick_exposer", "--mem_section", "--db_file_name"]

name = None ; mem_section=None ; db_file = None ; link_to_analyst = None
# monkey patching instead of if save data, send datas...
with_data_do = None
send_data = None
share_ticks = None

# Shared variable and lock
websocketPtr = None ; enable = False ; config = None ; logger = None
# Lock globals
asyncLoop = None
## Global sockets
realTimeTaSock = None ; ticksExposerSock = None ; databaseSock = None 
# List to store data
tickerList = None
dataList = {}
ohlcv_data = None


########################################################################
# config update modify carefully !!!
async def update_config(config_updated):
    global name ; global mem_section
    if type(config_updated) == Config: 
        pass
    else:
        config.mem_config = config_updated
        await check_tickers_list(name=name, section=mem_section)
async def from_sync_to_async(config_updated):
    await update_config(config_updated)
def async_config_update(config_updated):
    global asyncLoop
    _ = asyncLoop.create_task(from_sync_to_async(config_updated=config_updated))
# config update modify it carefully !!!
########################################################################

########################################################################
# data update, minimal datas -> date, ticker, price, quantity
async def async_post(ticker, record, maxe=51, save_from=1):
    global BROKER ; global with_data_do ; global send_data ; global share_ticks
    global ohlcv_data ; global dataList
    global name ; global logger 

    table_name = "{0}_tick".format(standardStr(ticker).upper())

    # expose data, if enabled
    await share_ticks([record[0], BROKER+"-"+record[1], record[2], record[3], record[4], record[5]])

    #async with asyncLock:
    try:
        data = dataList[table_name] 
    except:
        data = []

    data.insert(0, record)
    if (len(data)%5) == 0:
        ohlcv_data = data[:5]
        open = ohlcv_data[4][2]
        high = max(rec[2] for rec in ohlcv_data)
        low = min(rec[2] for rec in ohlcv_data)
        close = ohlcv_data[4][2]
        price = close
        volume = sum(float(rec[3]) for rec in ohlcv_data)
        date = record[0]
        # [key, price, open, high, low, close, volume, date]
        await send_data([BROKER+"-"+record[1], price, open, high, low, close, volume, date])

    # (date, ticker, price, quantity, tradeid, ordered, date_creat, user) -> database ou schema = BROKER, table = TICKER_tick
    data = await with_data_do(data, maxe, save_from, table_name)
    dataList[table_name] = data

# broker websocket part
async def on_error(websocket, error):
    await websocket.logger.asyncError("{0} : connection error : {1}".format(name, str(error)))

async def on_close(websocket, close_code, close_reason):
    await websocket.logger.asyncError("{0} : connection closed : {1} {2}".format(name, close_reason, close_code))

async def on_message(websocket, message):
    try:
        data = jsonLoads(message)
        date = datetime.utcfromtimestamp(data['E']/1000)
        ticker = data['s']
        price = data['p']
        quantity = data['q']
        tradeID = data['t']
        ordered = "sell" if data['m'] else "buy"
        await async_post(ticker=ticker, record=[date, standardStr(ticker), price, quantity, tradeID, ordered])
    except Exception as e: 
        if not (data == {'result':None, 'id':None} or data == {'result':None, 'id':'null'}): # subscribe, unsubscribe response...
            await websocket.logger.asyncError("{0} : error while trying to get trade infos : {1}".format(name, e))
        pass

async def subscribe(websocket, ticker):
    ticker = standardStr(ticker)
    subscribe_message = {"method": "SUBSCRIBE",
                        "params": [f"{standardStr(ticker)}@trade"]}
    try:
        await websocket.send(jsonDumps(subscribe_message))
    except Exception as e:
        await websocket.logger.asyncError("{0} : error while trying to subscribe to '{1}' : {2}".format(name, ticker, e))
        return False       
    await websocket.logger.asyncInfo("{0} : subscribed to trade stream : {1}".format(name, ticker))
    return True 

async def unSubscribe(websocket, ticker):
    global dataList
    ticker = standardStr(ticker)
    unsubscribe_message = {"method": "UNSUBSCRIBE",
                           "params": [f"{ticker}@trade"],
                           "id": "null"}
    try:
        await websocket.send(jsonDumps(unsubscribe_message))
    except Exception as e:
        await websocket.logger.asyncError("{0} : error while trying to unsubscribe to '{1}' trade infos : {2}".format(name, ticker, e))
        return False
    dataList.pop("{0}_tick".format(ticker.upper()), None)
    await websocket.logger.asyncInfo("{0} : unSubscribed to trade stream : {1}".format(name, ticker))
    return True 

@asyncRetry(delay=5, tries=-1) #? #FIXME on connexion lost ré-init TA-Analyst
async def watch_broker_ticks(name, logger):
    global BROKER
    global tickerList ; global uri
    global websocketPtr
    async with websockets.connect(uri) as websocket:
        websocket.logger = logger
        websocketPtr = websocket
        subscribe_message = {"method": "SUBSCRIBE",
                            "params": [f"{standardStr(ticker)}@trade" for ticker in tickerList]}
        await websocket.send(jsonDumps(subscribe_message))
        await websocket.logger.asyncInfo("{0} : websockets have been connected successfully to {1} : {2}".format(name, BROKER, uri))
        _ = await websocket.recv()
        async for message in websocket:
            await on_message(websocket, message)

# autoreload of config, check for new params
async def check_tickers_list(name, section):
    global BROKER
    global websocketPtr
    global asyncLoop ; global tickerList
    global config ; global logger
    global enabled 
    new_tickerList=None
    try:
        try:
            new_tickerList = getSplitedParam(config.mem_config[section][BROKER])
        except Exception as e:
            await logger.asyncCritical("{0} : error while trying to load ticker list from getSplitedParams : {1}".format(name, e))
            if new_tickerList == None: new_tickerList = tickerList
            pass
        # subscribe
        for tickerName in new_tickerList:
            if not tickerName in tickerList:
                #async with asyncLock:
                if (await subscribe(websocketPtr, tickerName)):
                    tickerList.append(tickerName)
        # unSubscribe
        removeList = []
        for tickerName in tickerList:
            if not tickerName in new_tickerList:
                #async with asyncLock:
                if (await unSubscribe(websocketPtr, tickerName)):
                    removeList.append(tickerName)
        if len(removeList)>0: tickerList=[ticker for ticker in tickerList if not ticker in removeList]
    except Exception as e:
        await logger.asyncCritical("{0} : error while trying to load params : {1}".format(name, e))
        pass

async def prepare_socket(name, IP, PORT):
    global logger ; global config
    AsyncSocketObj = None
    await logger.asyncInfo("{0} : init connection with real time : {1}.. .  . ".format(name, name.split("_")[-1]))
    AsyncSocketObj = await MyAsyncSocketObj(name=name).make_connection(server=IP, port=int(PORT))
    senderServer = AsyncSocketObj.sock_info[0]
    senderPort = int(AsyncSocketObj.sock_info[1])
    await AsyncSocketObj.send_data("{0}:{1}:{2}".format(name, senderServer, senderPort))
    return AsyncSocketObj

##########################################################################
# Main function to start the asyncio asyncLoop
async def tick_loader(name, mem_section, mode, tick_exposer, link_to_analyst):
    global BROKER
    global asyncLoop ; global tickerList
    global config ; global logger
    global enabled ; enabled = True 

    asyncLoop = asyncioGet_running_loop()

    # async socket for main tick loader, main analyst and main database
    if mode.lower()=="OneBrokerFull".lower():
        global databaseSock
        databaseSock = await prepare_socket(name="{0}_AnalystDB".format(name),
                                            IP=config.parser["ANALYST"]["ANALYST_SERVER"], 
                                            PORT=int(config.parser["ANALYST"]["ANALYST_DB_PORT"]))
    if tick_exposer or mode.lower()=="OneBrokerFull".lower(): 
        global ticksExposerSock
        ticksExposerSock = await prepare_socket(name="{0}_TickExposer".format(name),
                                                IP=config.parser["TICKEXPOSER"]["TICKEXPOSER_SERVER"],
                                                PORT=int(config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"]))
    if link_to_analyst or mode.lower()=="OneBrokerFull".lower(): 
        global realTimeTaSock
        realTimeTaSock = await prepare_socket(name="{0}_TaAnalyst".format(name),
                                              IP=config.parser["REALTIMETA"]["REALTIMETA_SERVER"], 
                                              PORT=int(config.parser["REALTIMETA"]["REALTIMETA_PORT"]))

    config.set_updateFunc(async_config_update)

    try:
        tickerList = getSplitedParam(config.mem_config[mem_section][BROKER])
        _ = await asyncLoop.create_task(watch_broker_ticks(name=name, logger=logger))
    except Exception as e:
        await logger.asyncCritical("{0} : error while trying to init streams : {1}".format(name, e))
        enabled = False
        exit(1)

    try:
        while True:
            if not enabled:
                asyncLoop.stop()
                await logger.asyncInfo("{0} : asyncio loop have been stopped at {1} !".format(name, datetime.utcnow()))
                break
            await asyncioSleep(5)
    except Exception as e:
        await logger.asyncCritical("{0} : error while trying to stop asyncio loop...".format(name))


#######################################################################
# Specific retry funcs on socket connection error 
from common.Helpers.helpers import asyncThreadQKill
from common.Helpers.os_helpers import nb_process_running
from common.Helpers.network_helpers import is_service_listen
async def RetryFuncLevel1Ptr(tries=-1, delay=0, max_delay=None, backoff=1, jitter=0, logger=None, name=None, socket=None, service_name=None, cmdLinePatt=None, argvPatt=None, reLauncher=None):
    running, pidList = nb_process_running(cmdlinePatt=cmdLinePatt, argvPatt=argvPatt, getPid=True)
    server, port = socket.sock_info ; sock_name = socket.Name
    if running:
        logger_msg = "{0} : {1} ({2} {3}) was not responding, kill signal has been sent at {4}!".format(name, service_name, cmdLinePatt, argvPatt, datetime.utcnow())
        await asyncThreadQKill(pidList=pidList, logger=logger, logger_msg=logger_msg)
        await asyncioSleep(1)
    # FIXME which parameters, maybe clear key should be implemented (over all processes)
    reLauncher()
    while not is_service_listen(server=server, port=port):
        await asyncioSleep(config.MAIN_QUEUE_BEAT)
    await socket.close_connection() ; socket = None
    socket = await prepare_socket(name=sock_name, IP=server, port=port) 

async def RetryFuncLevel2Ptr(tries=-1, delay=0, max_delay=None, backoff=1, jitter=0, logger=None, name=None, socket=None, service_name=None, cmdLinePatt=None, argvPatt=None, reLauncher=None):
    global config
    server, port = socket.sock_info ; sock_name = socket.Name
    if not is_process_running(cmdlinePatt=cmdLinePatt, argvPatt=argvPatt):
        # FIXME which parameters, maybe clear key should be implemented (over all processes)
        reLauncher()
        await logger.asyncError("{0} : {1} ({2} {3}) was down and has been restarted at {4}".format(name, service_name, cmdLinePatt, argvPatt, datetime.utcnow()))
        while not is_service_listen(server=server, port=port):
            await asyncioSleep(config.MAIN_QUEUE_BEAT)
    # try re_init_socket (after 3 times delay+jitter...)
    if tries > 3: 
        await socket.close_connection() ; socket = None
        socket = await prepare_socket(name=sock_name, IP=server, port=port) 
        await logger.asyncWarning("{0} : socket connection to {1} was not responding and has been restarted at {2}!".format(name, service_name, cmdLinePatt, argvPatt, datetime.utcnow()))
# Specific retry funcs on socket connection error 
#######################################################################


########################################################################
# process datas... 
async def do_not_send_data(data=None):
    pass

TaAnalyst_service_name=None ; TaAnalyst_cmdLinePatt=None ; TaAnalyst_argvPatt=None
@asyncRetry(delay=5, tries=-1, RetryFuncLevel1Ptr=RetryFuncLevel1Ptr, RetryFuncLevel2Ptr=RetryFuncLevel2Ptr, logger=logger, \
            name=name, socket=realTimeTaSock, service_name=TaAnalyst_service_name, cmdLinePatt=TaAnalyst_cmdLinePatt, argvPatt=TaAnalyst_argvPatt) # FIXME relauncher
async def send_data_to_main_TaAnalyst(data):
    global realTimeTaSock
    await realTimeTaSock.send_data(data)

ticksExposer_service_name=None ; ticksExposer_cmdLinePatt=None ; ticksExposer_argvPatt=None
@asyncRetry(delay=5, tries=-1, RetryFuncLevel1Ptr=RetryFuncLevel1Ptr, RetryFuncLevel2Ptr=RetryFuncLevel2Ptr, logger=logger, \
            name=name, socket=ticksExposerSock, service_name=ticksExposer_service_name, cmdLinePatt=ticksExposer_cmdLinePatt, argvPatt=ticksExposer_argvPatt) # FIXME relauncher
async def send_ticks_to_exposer(data):
    global ticksExposerSock 
    await ticksExposerSock.send_data(data)

database_service_name=None ; database_cmdLinePatt=None ; database_argvPatt=None
@asyncRetry(delay=5, tries=-1, RetryFuncLevel1Ptr=RetryFuncLevel1Ptr, RetryFuncLevel2Ptr=RetryFuncLevel2Ptr, logger=logger, \
            name=name, socket=databaseSock, service_name=database_service_name, cmdLinePatt=database_cmdLinePatt, argvPatt=database_argvPatt)  # FIXME relauncher
async def send_data_to_db(*args):
    global databaseSock 
    global logger ; global db_file ; global BROKER
    data, maxe, save_from, table_name = args
    if len(data) > maxe:
        data2save = data[save_from:]
        data = data[:save_from]
        data2save = data2save[::-1]
        await databaseSock.send_data([table_name, data2save])
    return data

async def clear_buffer(*args):
    global logger ; global db_file ; global BROKER
    data, maxe, save_from, table_name = args
    if len(data) > maxe:
        data2save = data[save_from:]
        data = data[:save_from]
        data2save = data2save[::-1]
    return data

async def save_data(*args):
    global name ; global logger ; global db_file ; global BROKER
    data, maxe, save_from, table_name = args
    if len(data) > maxe:
        data2save = data[save_from:]
        data = data[:save_from]
        data2save = data2save[::-1]
        try:
            sql_statement = "INSERT INTO {0} (date, ticker, price, quantity, tradeID, ordered) VALUES (?, ?, ?, ?, ?, ?)".format(table_name)
            with sqlite3Connect(db_file) as db:
                cursor = db.cursor()
                cursor.executemany(sql_statement, data2save)
                cursor.execute("COMMIT")
        except Exception as e:
            try:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS {0} (
                	id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date DATETIME,
                   	ticker TEXT NOT NULL,
                    price REAL NOT NULL,
                    quantity REAL NOT NULL,
                    date_creat DATETIME DEFAULT CURRENT_TIMESTAMP,
                    user TEXT DEFAULT '{1}',
                    tradeID BIGINT NOT NULL,
                    ordered TEXT NOT NULL)
                """.format(table_name, name))
                cursor.executemany(sql_statement, data2save)
                cursor.execute("COMMIT")
            except Exception as e:
                await logger.asyncCritical("{0} : error while trying to save records in table {1} in '{2}.db' : {3}".format(name, table_name, BROKER, e))
                exit(1)
    return data

# scheduler entry function...
def run_tick_loader(name, host="127.0.0.1", conf="analyst", mem_section=False, log_level=LOG_LEVEL, mode=DEFAULT_MODE, tick_exposer=False, db_file_name=False, link_to_analyst=False):
    global BROKER ; global with_data_do ; global send_data ; global share_ticks
    global logger ; global config ; global db_file

    config, logger = init_logger(name=name, config=conf, log_level=log_level)

    if mode == "OneBrokerFull".lower():
        # mode full : default name
        name = osPathBasename(__file__).replace(".py", '')

        # mode full : default section
        mem_section = name.replace(BROKER+"_", '').lower().replace(".py", '')
        if (config.mem_config == None) or (not config.mem_config.get(mem_section, False)) or (not config.mem_config[mem_section].get(BROKER, False)):
            config.update_mem_config(section_key_val_dict={mem_section:{BROKER:'BTC/USDT'}})

        # mode full : tick_loader send data to rt_ta_analyst
        link_to_analyst = True
        rt_ta_analyst = "rt_ta_analyst" ; rt_ta_argvPatt = f"--name {name}_{mode.lower()}"
        if not is_process_running(cmdlinePatt=rt_ta_analyst, argvPatt=rt_ta_argvPatt):
            from time import sleep
            from common.Helpers.os_helpers import launch_rt_ta_analyst
            from common.Helpers.network_helpers import is_service_listen
            launch_rt_ta_analyst(mode=mode)
            while not is_service_listen(server=config.parser["REALTIMETA"]["REALTIMETA_SERVER"], port=config.parser["REALTIMETA"]["REALTIMETA_PORT"]):
                sleep(config.MAIN_QUEUE_BEAT)
            logger.info("Main RT TA Analyst : Main RT TA Analyst is starting.. .  . ")
        global TaAnalyst_service_name ; global TaAnalyst_cmdLinePatt ; global TaAnalyst_argvPatt
        TaAnalyst_service_name=None ; TaAnalyst_cmdLinePatt=rt_ta_analyst ; TaAnalyst_argvPatt=rt_ta_argvPatt

        # mode full : send data to DB_recorder
        bd_recorder = "db_recorder"
        if not is_process_running(cmdlinePatt=bd_recorder, argvPatt=f"--name {bd_recorder}"):
            from time import sleep
            from common.Helpers.os_helpers import launch_db_recorder
            from common.Helpers.network_helpers import is_service_listen
            launch_db_recorder(name=f"{bd_recorder}", mode=mode)
            while not is_service_listen(server=config.parser["DBRECORDER"]["DBRECORDER_SERVER"], port=config.parser["DBRECORDER"]["DBRECORDER_PORT"]):
                sleep(config.MAIN_QUEUE_BEAT)
            logger.info("Main Database Recorder : Database Recorder is starting.. .  . ")
            pass      
        with_data_do = send_data_to_db 

        # mode full : start asyncio server to push datas to clients
        tick_exposer = True
        ticks_exposer = "ticks_exposer"
        if not is_process_running(cmdlinePatt=ticks_exposer, argvPatt=''):
            from time import sleep
            from common.Helpers.os_helpers import launch_ticks_exposer
            from common.Helpers.network_helpers import is_service_listen
            launch_ticks_exposer(mode=mode)
            while not is_service_listen(server=config.parser["TICKEXPOSER"]["TICKEXPOSER_SERVER"], port=config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"]):
                sleep(config.MAIN_QUEUE_BEAT)
            logger.info("Main Tick Exposer : Main Tick Exposer is starting.. .  . ")

    else:    
        if not mem_section:
            mem_section = name.replace(BROKER+"_", '').lower().replace(".py", '')
        if (config.mem_config == None) or (not config.mem_config.get(mem_section, False)) or (not config.mem_config[mem_section].get(BROKER, False)):
            config.update_mem_config(section_key_val_dict={mem_section:{BROKER:'BTC/USDT'}})
        
        # main tick_loader send data to rt_ta_analyst
        if link_to_analyst: 
            rt_ta_analyst = "rt_ta_analyst"
            if not is_process_running(cmdlinePatt=rt_ta_analyst, argvPatt=''):
                from time import sleep
                from common.Helpers.os_helpers import launch_rt_ta_analyst
                from common.Helpers.network_helpers import is_service_listen
                # FIXME check parameters
                launch_rt_ta_analyst()
                while not is_service_listen(server=config.parser["REALTIMETA"]["REALTIMETA_SERVER"], port=config.parser["REALTIMETA"]["REALTIMETA_PORT"]):
                    sleep(config.MAIN_QUEUE_BEAT)
                logger.info("Main RT TA Analyst : Main RT TA Analyst is starting.. .  . ")
            send_data = send_data_to_main_TaAnalyst
        else: send_data = do_not_send_data

        # save datas in database
        db_file = db_file_name
        if db_file:
            db_file = osPathJoin(osPathDirname(osPathDirname(__file__)), "{0}.db".format(db_file_name.lower()))
            with_data_do = save_data
        else:with_data_do = clear_buffer

        # start asyncio server to push datas to clients
        if tick_exposer:
            share_ticks = send_ticks_to_exposer
            ticks_exposer = "ticks_exposer"
            if not is_process_running(cmdlinePatt=ticks_exposer, argvPatt=''):
                from time import sleep
                from common.Helpers.os_helpers import launch_ticks_exposer
                from common.Helpers.network_helpers import is_service_listen
                # FIXME check parameters
                launch_ticks_exposer()
                while not is_service_listen(server=config.parser["TICKEXPOSER"]["TICKEXPOSER_SERVER"], port=config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"]):
                    sleep(config.MAIN_QUEUE_BEAT)
                logger.info("Main Tick Exposer : Main Tick Exposer is starting.. .  . ")
        else: share_ticks = do_not_send_data

    asyncioRun(tick_loader(name=name, mem_section=mem_section, mode=mode, tick_exposer=tick_exposer, link_to_analyst=link_to_analyst))


#================================================================
if __name__ == "__main__":
    from sys import argv
    from os.path import basename as osPathBasename
    from ast import literal_eval

    name = osPathBasename(__file__).replace(".py", '')
    log_level = LOG_LEVEL
    configStr = "analyst"
    mem_section = "tick_loaders"

    if len(argv) > 1:
        try :
            argsAndVal, defaultArgs = default_arguments(argv=argv, specificArgs=SPECIFIC_ARGS)
            if argsAndVal:
                if "name" in argsAndVal: name = argsAndVal["name"]
                if "port" in argsAndVal: argsAndVal.pop("port") # not used
                if "host" in argsAndVal: argsAndVal.pop("host") # FIXME teleportation !
                if not "name" in argsAndVal: argsAndVal["name"] = name
                if not "conf" in argsAndVal: argsAndVal["conf"] = configStr
                if not "log_level" in argsAndVal: argsAndVal["log_level"] = log_level
                if not "mem_section" in argsAndVal: argsAndVal["mem_section"] = name 
                argsAndVal["tick_exposer"] = literal_eval((argsAndVal["tick_exposer"]).capitalize()) if "tick_exposer" in argsAndVal else False
                if not "db_file_name" in argsAndVal: argsAndVal["db_file_name"] = BROKER if name == osPathBasename(__file__).replace("py", '') else False
                
                if not "mode" in argsAndVal: argsAndVal["mode"]= DEFAULT_MODE.lower()
                argsAndVal["mode"] = argsAndVal["mode"].lower()
                if not is_process_running(cmdlinePatt=osPathBasename(__file__), argvPatt="--name {0}".format(name), exceptThisPid=osGetpid()):
                    argsAndVal["link_to_analyst"] = True if name == osPathBasename(__file__).replace("py", '') else False
                    run_tick_loader(**argsAndVal)
            else:
                cmdLineInfo = """
                Authorized arguments : \n \
                    default optional arguments :\n \
                        --name \n \
                        --host \n \
                        --port \n \
                        --conf \n \
                        --log_level \n \
                    --mode \n \
                        if mode "OneBrokerFull" selected (default mode = "OneBrokerLight"), link_to_analyst and tick_exposer are enabled, db_file is not used, DB_recorder service is used instead...
                    --link_to_analyst \n \
                        True only for main tick loader \n \
                    --tick_exposer \n \
                        start a TPC server to send data \n \
                    --mem_section \n \
                        name of memory configuration section \n \
                    --db_file \n \
                        database name, stored in analyst directory\n \
                """.format(argv)
                _, logger = init_logger(name=name, config="common", log_level=log_level)
                logger.error("{0} : error while trying to launch the service, wrong parameter(s) provided : {1}\n {2}".format(name, str(argv), cmdLineInfo))
        except Exception as e:
            _, logger = init_logger(name=name, config="common", log_level=log_level)
            logger.error("{0} : unexpected error while trying to launch the service, parameter(s) provided : {1} => {2}".format(name, str(argv), e))
    else:
        if not is_process_running(cmdlinePatt=osPathBasename(__file__), argvPatt="--name {0}".format(name), exceptThisPid=osGetpid()):
            """
            #####################################################################
            # most lightweight                                                  #
            #   - tick feeder for DB:                                           #
            #       run_tick_loader(name=name, db_file_name=BROKER)             #
            #   - tick feeder for Analyst:                                      #
            #       run_tick_loader(name=name, link_to_analyst="rt_ta_analyst") #
            #   - tick exposer for TCP client:                                  #
            #       run_tick_loader(name=name, tick_exposer=True)               #
            #####################################################################
            """

            # mode-one-broker-full
            # run_tick_loader(name=name, mode="OneBrokerFull".lower())

            # mode-one-broker-light 
            run_tick_loader(name=name, link_to_analyst="rt_ta_analyst", tick_exposer=True, db_file_name=BROKER)
        else:
            print("{0} is already running...".format(name))


