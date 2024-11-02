#!/usr/bin/env python
# coding:utf-8

from os import name as osName, getpid as osGetpid
from collections import deque
from asyncio import run as asyncioRun, set_event_loop_policy as asyncioSet_event_loop_policy, \
                    start_server as asyncioStart_server, get_event_loop as asyncioGet_event_loop, \
                    gather as asyncioGather, Queue as asyncioQueue, Lock as asyncioLock
from json import dumps as jsonDumps



# relative import
from sys import path;path.extend("..")
from common.TeleRemote.tele_command import ATelecommand
from common.Helpers.os_helpers import is_process_running
from common.Helpers.helpers import Singleton, init_logger, default_arguments, getOrDefault, getUnusedPort
from common.Helpers.network_helpers import SafeAsyncSocket

if osName != 'nt':
    import uvloop
    asyncioSet_event_loop_policy(uvloop.EventLoopPolicy())

LOG_LEVEL = 20
DEFAULT_MODE = "OneBrokerLight" 
ATICKS_DISPATCHER_NAME = "ticks_exposer" 
SPECIFIC_ARGS = ["--mode", "--in_port", "--out_port", "ws_port"]
asyncLock = asyncioLock()


########################################################################################################################################

class AMsgBrok(metaclass=Singleton):
    """
    class to simulate buffer socket for incoming message  
    """
    logger = None
    subsLock = asyncioLock()
    def __init__(self, name, logger):
        self.Name = name
        self.logger = logger
        self.msg_filter = set()
        self.name_sockPtr = {} # dict, val is str
        self.msg_sockPtr = {} # dict, val is set()
        self.name_msg = {} # dict, val is set() 
        self.TickQueue = asyncioQueue()

    def add_subscriber(self, name, subSockPtr):
        self.name_sockPtr[name] = subSockPtr
        
    async def subscribe(self, name, subSockPtr, subMessage):
        try:
            try: (self.msg_sockPtr[subMessage]).add(subSockPtr)
            except: self.msg_sockPtr[subMessage] = {subSockPtr}
            try: (self.name_msg[name]).add(subMessage)
            except: self.name_msg[name] = {subMessage}
            if not subMessage in self.msg_filter:
                self.msg_filter.add(subMessage)
        except Exception as e:
            err_msg = "{0} : subscriber '{1}' error while trying to '{2}' : {3}".format(self.Name, subSockPtr.clientName, subMessage, e)
            try: await subSockPtr.send_data(err_msg)
            except: pass
            await self.logger.asyncError(err_msg)
            pass

    async def unSubscribe(self, name, subSockPtr, unSubMessage):
        try:
            sockSet = self.msg_sockPtr[unSubMessage]
            newSockSet = {sockObj for sockObj in sockSet if not subSockPtr.guid == sockObj.guid}
            if len(newSockSet) > 0: sockSet = newSockSet
            else: self.msg_filter.remove(unSubMessage) ; self.msg_sockPtr.pop(unSubMessage, None)
            (self.name_msg[name]).remove(unSubMessage)    
        except Exception as e: 
            err_msg = "{0} : subscriber '{1}' error while trying to '{2}' : {3}".format(self.Name, subSockPtr.clientName, unSubMessage, e)
            try: await subSockPtr.send_data(err_msg)
            except: pass
            await self.logger.asyncError(err_msg)
            pass

    async def remove_subscriber(self, name, subSockPtr):
        async with self.subsLock:
            try: self.name_sockPtr.pop(name, None)
            except: pass
            try: self.name_msg.pop(name, None)
            except: pass
            delMsgFilter = set()
            for msg, sockSet in self.msg_sockPtr.items():
                try: 
                    newSockSet = {sockObj for sockObj in sockSet if not sockObj.clientName == name}
                    if len(newSockSet) > 0: self.msg_sockPtr[msg] = newSockSet
                    else: delMsgFilter.add(msg)
                except Exception as e:
                    err_msg = "{0} : error while trying to remove subscriber '{1}' : {2}".format(self.Name, subSockPtr.clientName, e)
                    #await subSockPtr.send_data(err_msg) => not needed client disconnected...
                    await self.logger.asyncError(err_msg)
                    continue
            if len(delMsgFilter) > 0: 
                try: 
                    for msg in delMsgFilter:
                        self.msg_sockPtr.pop(msg, None) 
                    self.msg_filter.difference_update(delMsgFilter) 
                except: pass #empty msg_filter

    async def received_data(self, data):
        async with self.subsLock:
            if data[1] in self.msg_filter:
                await self.TickQueue.put(data)

    @staticmethod
    async def gather_send_data(Name, sockPtr, data, logger):
        try:
            await sockPtr.send_data(data)
        except ConnectionResetError:
            pass
        except Exception as e:
            await logger.asyncError("{0} : error while trying to send message '{1}' to subscriber '{2}' : {3}".format(Name, data[1], getOrDefault(sockPtr.clientName, "#N/A"), e))
            pass
    @staticmethod
    async def send_data(selfObj):
        while True:
            data = await selfObj.TickQueue.get()
            async with selfObj.subsLock:
                tasks = [selfObj.gather_send_data(selfObj.Name, sockPtr, data, selfObj.logger) for sockPtr in selfObj.msg_sockPtr.get(data[1], [])]
                await asyncioGather(*tasks)
                selfObj.TickQueue.task_done()

    async def receive_sub_data(self, name, subSockPtr, message):
        try:
            action, msg = message.split('|')
            if action.upper()=="SUBSCRIBE":
                await self.subscribe(name=name, subSockPtr=subSockPtr, subMessage=msg)
            elif action.upper()=="UNSUBSCRIBE":
                await self.unSubscribe(name=name, subMessage=msg)
            else:
                err_msg= "{0} : received unknown action '{1}' from '{2}', please check... ({3})".format(self.Name, action, subSockPtr.clientName, message)
                await subSockPtr.send_data(err_msg)
                await self.logger.asyncError(err_msg)
        except Exception as e:
            err_msg= "{0} : error while receiving message '{1}' from '{2}' : {3}".format(self.Name, message, subSockPtr.clientName, e)
            await subSockPtr.send_data(err_msg)
            await self.logger.asyncError(err_msg)
            pass

########################################################################################################################################
# 2 differents class/Queue as websockets doesn't run as faster as async TCP and used for displaying
class AMsgBrokWs(metaclass=Singleton):
    """
    class to simulate buffer socket and websocket for incoming message  
    """
    logger = None
    subsLockWs = asyncioLock()
    def __init__(self, logger, name):
        self.Name = name
        self.logger = logger
        self.msg_filter_ws = set()
        self.ticker_wsSock = {}
        self.wsSock_ticker = {}
        self.TickQueueWs = asyncioQueue()

    async def add_subscriber_ws(self, subWsSockPtr, ticker):
        async with self.subsLockWs:
            try: (self.ticker_wsSock[ticker]).add(subWsSockPtr)
            except: self.ticker_wsSock[ticker] = {subWsSockPtr}
            try: (self.wsSock_ticker[subWsSockPtr]).add(ticker)
            except: self.wsSock_ticker[subWsSockPtr] = {ticker}
            self.msg_filter_ws.add(ticker)

    async def subscribe_ws(self,  subWsSockPtr, ticker):
        async with self.subsLockWs:
            try: (self.ticker_wsSock[ticker]).add(subWsSockPtr)
            except: self.ticker_wsSock[ticker] = {subWsSockPtr}
            try: (self.wsSock_ticker[subWsSockPtr]).add(ticker)
            except: self.wsSock_ticker[subWsSockPtr] = {ticker}
            self.msg_filter_ws.add(ticker)

    async def unSubscribe_ws(self, subWsSockPtr, ticker):
        delMsgFilter = set()
        async with self.subsLockWs:
            self.wsSock_ticker[subWsSockPtr] = {tickItem for tickItem in self.wsSock_ticker[subWsSockPtr] if tickItem!=ticker}
            new_wsSockSet = {wsSock for wsSock in self.ticker_wsSock[ticker] if wsSock != subWsSockPtr}
            if len(new_wsSockSet) > 0: self.ticker_wsSock[ticker] = new_wsSockSet
            else: delMsgFilter.add(new_wsSockSet)
            if len(delMsgFilter) > 0: 
                try: 
                    self.msg_filter_ws.difference_update(delMsgFilter)  
                    self.ticker_wsSock.pop(ticker, None)   
                except: pass #empty msg_filter
                
    async def removeSubscriber_ws(self, subWsSockPtr, ticker):
        delMsgFilter = set()
        async with self.subsLockWs:
            self.wsSock_ticker.pop(subWsSockPtr, None)
            for ticker, wsSockSet in self.ticker_wsSock.items(): 
                try:
                    new_wsSockSet = {wsSock for wsSock in wsSockSet if wsSock != subWsSockPtr}
                    if len(new_wsSockSet) > 0: self.ticker_wsSock[ticker] = new_wsSockSet
                    else: delMsgFilter.add(ticker)
                except Exception as e:
                    err_msg = "{0} : error while trying to remove websocket subscriber : {1}".format(self.Name, e)
                    #await subSockPtr.send_data(err_msg) => not needed client disconnected...
                    await self.logger.asyncError(err_msg)
                    continue
            if len(delMsgFilter) > 0: 
                try: 
                    self.msg_filter_ws.difference_update(delMsgFilter)
                    self.ticker_wsSock.pop(ticker, None)    
                except: pass #empty msg_filter

    async def received_data_ws(self, data):
        async with self.subsLockWs:
            if data[1] in self.msg_filter_ws:
                await self.TickQueueWs.put(data)

    @staticmethod
    async def gather_send_data_ws(Name, sockPtrWs, data, logger):
        try:
            await sockPtrWs.send(jsonDumps(data))
        except (websocketsExceptions.ConnectionClosedError, websocketsExceptions.ConnectionClosedOK):
            pass
        except Exception as e:
            await logger.asyncError("{0} : error while trying to send websocket message '{1}' : {2}".format(Name, data[1], e))
            pass
    @staticmethod
    async def send_data_ws(selfObjWs):
        while True:
            data = await selfObjWs.TickQueueWs.get()
            data[0] = (data[0]).isoformat()
            async with selfObjWs.subsLockWs:
                tasks = [selfObjWs.gather_send_data_ws(selfObjWs.Name, sockPtrWs, data, selfObjWs.logger) for sockPtrWs in selfObjWs.ticker_wsSock.get(data[1],[])]
                await asyncioGather(*tasks)
                selfObjWs.TickQueueWs.task_done()

    async def receive_sub_data_ws(self, subWsSockPtr, message):
        try:
            action, ticker = message.split('|')
            if action.upper()=="SUBSCRIBE":
                await self.subscribe_ws(subWsSockPtr=subWsSockPtr, ticker=ticker)
            elif action.upper()=="UNSUBSCRIBE":
                await self.unSubscribe_ws(subWsSockPtr=subWsSockPtr, ticker=ticker)
            else:
                err_msg= "{0} : received unknown websocket action '{1}', please check... ({2})".format(self.Name, action, ticker)
                await subWsSockPtr.send_data(err_msg)
                await self.logger.asyncWarning(err_msg)
        except Exception as e:
            err_msg= "{0} : error while receiving websocket message '{1}' : {2}".format(self.Name, message, e)
            await subWsSockPtr.send_data(err_msg)
            await self.logger.asyncError(err_msg)
            pass

########################################################################################################################################

class ATickExposer(ATelecommand, metaclass=Singleton):
    Name = ATICKS_DISPATCHER_NAME
    feederSet = set()
    asyncLoop = None
    def __init__(self, config, logger, name:str=None, host="127.0.0.1", in_port:int=None, out_port:int=None, ws_port:int=None, autorun=True, asyncLoop=None):
        if not name is None:
            self.Name = name

        self.config = config
        self.logger = logger
        self.aMsgBrok = None
        self.teleAsyncHook = None
        self.state = "inited"

        # async loop
        if not asyncLoop is None: self.asyncLoop = asyncLoop
        else: self.asyncLoop = asyncioGet_event_loop()
        
        # server connection interface from tick_loaders
        self.async_in_tcp_server = None
        self.in_port = in_port

        # server connection interface to clients
        self.async_out_tcp_server = None
        self.out_port = out_port

        if not ws_port is None: 
            # server connection display interface websocket to clients
            from logging import getLogger, NullHandler
            getLogger("websockets").addHandler(NullHandler())
            getLogger("websockets").propagate = False
            global websocketsExceptions
            from websockets import exceptions as websocketsExceptions
            self.aMsgBrokWs = None
            self.ws_server = None
            self.ws_port = ws_port if not ws_port == True else int(getUnusedPort())

        # telecommand
        self.TeleBufQ = deque()

        if autorun:
            self.run_forever(host=host, in_port=in_port, out_port=out_port, ws_port=ws_port)

    ####################################################################
    # Run servers forever
    def run_forever(self, host, in_port, out_port, ws_port=None):
        # telecommand part
        self.teleAsyncHook = self.asyncLoop.create_task(self.TeleCommand())
        # run aMsgBrok socket
        self.aMsgBrok = AMsgBrok(name="{0}_MsgBrok".format(self.Name), logger=self.logger)      
        self.asyncLoop.create_task(AMsgBrok.send_data(self.aMsgBrok))
        if not ws_port is None:
            # run aMsgBrokWs websocket
            self.aMsgBrokWs = AMsgBrokWs(name="{0}_MsgBrokWs".format(self.Name), logger=self.logger)      
            self.asyncLoop.create_task(AMsgBrokWs.send_data_ws(self.aMsgBrokWs))
            self.process_data=self.process_data_ws
        # internal communication
        IN_TCP_server = self.asyncLoop.create_task(self.run_TCP_feeder_server(host=host, in_port=in_port))
        # external communication
        OUT_TCP_server = self.asyncLoop.create_task(self.run_TCP_client_server(host=host, out_port=out_port))
        if not ws_port is None:
            # external communication
            OUT_WS_server = self.asyncLoop.create_task(self.run_WS_client_server(name=name, host=host, ws_port=ws_port))         
        # run_forever
        self.asyncLoop.run_forever()

    ####################################################################
    # send to TCP, or TCP and WS
    @staticmethod
    async def process_data(selfObj, data):
        await selfObj.aMsgBrok.received_data(data)
    @staticmethod
    async def process_data_ws(selfObj, data):
        await selfObj.aMsgBrok.received_data(data)
        await selfObj.aMsgBrokWs.received_data_ws(data)

    ####################################################################
    # in TCP communication
    @staticmethod
    async def handle_TCP_feeder(reader, writer, iAMatrixQ):
        asyncSock = SafeAsyncSocket(reader=reader, writer=writer)
        data = await asyncSock.receive_data()
        if not data:
            asyncSock.writer.close()
            await asyncSock.writer.wait_closed()
            return
        
        clientName, host, port = data.split(':') ; port = int(port)
        asyncSock.clientName = clientName
        
        if clientName in iAMatrixQ.feederSet:
            await iAMatrixQ.logger.asyncInfo("{0} : '{1}' already connected, closing connection...".format(iAMatrixQ.Name, clientName, host, port))
            asyncSock.writer.close()
            await asyncSock.writer.wait_closed()
            return 
        iAMatrixQ.feederSet.add(clientName)
        
        await iAMatrixQ.logger.asyncInfo("{0} : '{1}' has established connection without encryption from '{2}' destport '{3}'".format(iAMatrixQ.Name, clientName, host, port))
        while True:
            try:
                data = await asyncSock.receive_data()
            except ConnectionResetError:
                break
            except Exception as e:
                await iAMatrixQ.logger.asyncError("{0} : error while trying to received data from '{1}' : {2}".format(iAMatrixQ.Name, clientName, e))
                break
            if not data:
                break
            await iAMatrixQ.process_data(iAMatrixQ, data)

        iAMatrixQ.feederSet.remove(clientName)
        asyncSock.writer.close()
        await asyncSock.writer.wait_closed()
        await iAMatrixQ.logger.asyncInfo("{0} : '{1}' disconnected from '{2}' destport '{3}'".format(iAMatrixQ.Name, clientName, host, port))
        return

    async def run_TCP_feeder_server(self, host, in_port):
        self.async_in_tcp_server = await asyncioStart_server(lambda reader, writer: ATickExposer.handle_TCP_feeder(reader=reader, writer=writer, iAMatrixQ=self), host=host, port=in_port)
        await self.logger.asyncInfo("{0} async TCP tickFeeder server : socket async TCP tickFeeder handler is open : {1}, srcport {2}".format(self.Name, host, in_port))
        async with self.async_in_tcp_server:
            await self.async_in_tcp_server.serve_forever()

    ####################################################################
    # out TCP communication
    @staticmethod
    async def handle_TCP_client(reader, writer, eAMatrixQ):
        asyncSock = SafeAsyncSocket(reader=reader, writer=writer)
        data = await asyncSock.receive_data()
        if not data:
            asyncSock.writer.close()
            await asyncSock.writer.wait_closed()
            return
        
        clientName, host, port = data.split(':') ; port = int(port) 
        asyncSock.clientName = clientName
        eAMatrixQ.aMsgBrok.add_subscriber(name=clientName, subSockPtr=asyncSock)
        
        await eAMatrixQ.logger.asyncInfo("{0} : '{1}' has established connection without encryption from '{2}' destport '{3}'".format(eAMatrixQ.Name, clientName, host, port))
        while True:
            try:
                # either sub, either unSub 
                data = await asyncSock.receive_data()
            except ConnectionResetError:
                break
            except Exception as e:
                await eAMatrixQ.logger.asyncError("{0} : error while trying to received data from '{1}' : {2}".format(eAMatrixQ.Name, clientName, e))
                break
            if not data:
                break
            await eAMatrixQ.aMsgBrok.receive_sub_data(name=clientName, subSockPtr=asyncSock, message=data)

        await eAMatrixQ.aMsgBrok.remove_subscriber(name=clientName, subSockPtr=asyncSock)
        asyncSock.writer.close()
        await asyncSock.writer.wait_closed()
        await eAMatrixQ.logger.asyncInfo("{0} : '{1}' disconnected from '{2}' destport '{3}'".format(eAMatrixQ.Name, clientName, host, port))
        return

    async def run_TCP_client_server(self, host, out_port):
        self.async_out_tcp_server = await asyncioStart_server(lambda reader, writer: ATickExposer.handle_TCP_client(reader=reader, writer=writer, eAMatrixQ=self), host=host, port=out_port)
        await self.logger.asyncInfo("{0} async TCP client server : socket async TCP client handler is open : {1}, srcport {2}".format(self.Name, host, out_port))
        async with self.async_out_tcp_server:
            await self.async_out_tcp_server.serve_forever()

    ####################################################################
    # out WS communication
    @staticmethod
    async def handle_WS_client(websocket, ticker, wAMatrixQ):
        ticker = ticker[1:]
        await wAMatrixQ.aMsgBrokWs.add_subscriber_ws(subWsSockPtr=websocket, ticker=ticker)

        while True: 
            try:
                data = await websocket.recv()
            except (websocketsExceptions.ConnectionClosedError, websocketsExceptions.ConnectionClosedOK):
                break
            except Exception as e:
                await wAMatrixQ.logger.asyncError("{0} : error while trying to received websocket data : {1}".format(wAMatrixQ.Name, e))
                continue
            await wAMatrixQ.aMsgBrokWs.receive_sub_data_ws(subWsSockPtr=websocket, message=data)

        await wAMatrixQ.aMsgBrokWs.removeSubscriber_ws(subWsSockPtr=websocket, ticker=ticker)

    async def run_WS_client_server(self, name, host, ws_port):
        from websockets.server import serve as websocketsServe
        try:                                            
            self.async_ws_server = await websocketsServe(lambda websocket, ticker: ATickExposer.handle_WS_client(websocket=websocket, ticker=ticker, wAMatrixQ=self), host=host, port=ws_port)
            await self.logger.asyncInfo("{0} websocket server : websocket client handler is open : {1}, srcport {2}".format(name, host, ws_port))
            async with self.async_ws_server:
                await self.async_ws_server.serve_forever()
        except Exception as e:
            await self.logger.asyncError("{0} : error while trying to start websocket server : '{1}'".format(name, e))
            exit(1)

    #####################################################################
    ## Telecommand part
    def get_asyncLock(self):
        global asyncLock
        return asyncLock
    
    def telePortMe(self):
        # do something
        pass

# scheduler entry function...
def run_tick_exposer(name, conf="analyst", host="127.0.0.1", in_port=None, out_port=None, log_level=LOG_LEVEL, mode=DEFAULT_MODE.lower(), ws_port=True):
    config, logger = init_logger(name=name, config=conf, log_level=log_level)
    mainTickDispatcher = ATickExposer(config=config, logger=logger, in_port=in_port, out_port=out_port, ws_port=ws_port, autorun=False)
    if not in_port is None:
        config.update(section="TICKEXPOSER", configPath=config.COMMON_FILE_PATH, params={"TICKEXPOSER_IN_PORT":in_port}, name=name)
    if not out_port is None:
        config.update(section="TICKEXPOSER", configPath=config.COMMON_FILE_PATH, params={"TICKEXPOSER_OUT_PORT":out_port}, name=name)
    if mode=="OneBrokerFull".lower(): 
        ws_displayer = "ws_displayer"
        if not is_process_running(cmdlinePatt=ws_displayer, argvPatt=f"--name {ws_displayer}_{mode}"):
            from time import sleep
            from common.Helpers.os_helpers import launch_ws_displayer
            from common.Helpers.network_helpers import is_service_listen
            launch_ws_displayer(name=f"{ws_displayer}_{mode}", mode=mode)
            while not is_service_listen(server=config.parser["WSDISPLAYER"]["WSDISPLAYER_SERVER"], port=config.parser["WSDISPLAYER"]["WSDISPLAYER_WS_PORT"], ws=True):
                sleep(config.MAIN_QUEUE_BEAT)
            logger.info("Main WS Displayer : Main WS Displayer is starting.. .  . ")
        asyncioRun(mainTickDispatcher.run_forever(host=host, in_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"], out_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_OUT_PORT"]))
    elif ws_port:
        if ws_port == True and not config.parser.has_option("TICKEXPOSER", "TICKEXPOSER_WS_PORT"):
            ws_port = getUnusedPort()
        elif ws_port != True:
            config.update(section="TICKEXPOSER", configPath=config.COMMON_FILE_PATH, params={"TICKEXPOSER_WS_PORT":ws_port}, name=name)
        else: 
            ws_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_WS_PORT"]
        asyncioRun(mainTickDispatcher.run_forever(host=host, in_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"], out_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_OUT_PORT"], ws_port=ws_port))
    else:
        asyncioRun(mainTickDispatcher.run_forever(host=host, in_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_IN_PORT"], out_port=config.parser["TICKEXPOSER"]["TICKEXPOSER_OUT_PORT"]))

#================================================================
if __name__ == "__main__":
    from sys import argv
    from os.path import basename as osPathBasename
    from ast import literal_eval

    name = osPathBasename(__file__).replace(".py", '')
    log_level = LOG_LEVEL
    configStr = "analyst"

    if len(argv) > 1:
        from common.Helpers.helpers import init_logger
        try :
            argsAndVal, defaultArgs = default_arguments(argv=argv, specificArgs=SPECIFIC_ARGS)
            if argsAndVal:
                if "name" in argsAndVal: name = argsAndVal["name"]
                if "host" in argsAndVal: argsAndVal.pop("host") # FIXME teleportation !
                if "ws_port" in argsAndVal: argsAndVal["ws_port"] = literal_eval(argsAndVal["ws_port"].capitalize() or argsAndVal["ws_port"])
                if not "name" in argsAndVal: argsAndVal["name"] = name
                if not "conf" in argsAndVal: argsAndVal["conf"] = configStr
                if not "log_level" in argsAndVal: argsAndVal["log_level"] = log_level

                if not "mode" in argsAndVal: argsAndVal["mode"] = DEFAULT_MODE.lower()
                argsAndVal["mode"] = argsAndVal["mode"].lower()
                if not is_process_running(cmdlinePatt=osPathBasename(__file__), argvPatt="--name {0}".format(name), exceptThisPid=osGetpid()):
                    run_tick_exposer(**argsAndVal)
            else:
                cmdLineInfo = """
                Authorized arguments : \n \
                    default optional arguments :\n \
                        --name \n \
                        --host \n \
                        --in_port \n \
                        --out_port \n \
                        --conf \n \
                        --log_level \n \
                    --mode \n \
                        if mode "OneBrokerFull" selected (default mode = "OneBrokerLight"), ws_port is disable, ws_displayer is used
                    --ws_port \n \
                        if tick exposer also used as displayer, True or port Number\n \
                """.format(argv)
                _, logger = init_logger(name=name, config="common", log_level=log_level)
                logger.error("{0} : error while trying to launch the service, wrong parameter(s) provided : {1}\n {2}".format(name, str(argv), cmdLineInfo))
        except Exception as e:
            _, logger = init_logger(name=name, config="common", log_level=log_level)
            logger.error("{0} : unexpected error while trying to launch the service, parameter(s) provided : {1} => {2}".format(name, str(argv), e))
    else:
        if not is_process_running(cmdlinePatt=osPathBasename(__file__), argvPatt="--name {0}".format(name), exceptThisPid=osGetpid()):
            # mode-one-broker-full 
            # run_tick_exposer(name=name, conf=configStr, log_level=LOG_LEVEL, mode="OneBrokerFull".lower())
            # ws mode-one-broker-light
            run_tick_exposer(name=name, conf=configStr, ws_port=True, log_level=LOG_LEVEL)
        else:
            print("{0} is already running...".format(name))