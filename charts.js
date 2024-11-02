// chart.js


import WebSocketClient from './websocket.js';

const green = '#26a69a';
const red = '#ef5350';
let TA_WebSocket=null;
let Tick_WebSocket=null;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class TA_WebSocketBindingManager {
    constructor(websocketUrl) {
        // singleton js
        if (TA_WebSocketBindingManager.instance) {      return TA_WebSocketBindingManager.instance;     }

        this.bindingsOnOpen = new Map();
        this.bindingsOnMessage = new Map();
        this.bindingsOnClose = new Map();
        this.bindingsOnError = new Map();
        this.currentId = 0
        TA_WebSocket = this.TA_WebSocket = new WebSocketClient({url: websocketUrl, onMessageCallback: this.onmessage.bind(this), onOpenCallback: this.onopen.bind(this), onCloseCallback: this.onclose.bind(this), onErrorCallback: this.onerror.bind(this)});
        TA_WebSocketBindingManager.instance = this;
        return this;
    }
    
    _generateId() {     return this.currentId++;    }
    bind(object, methodName) {
        let id = this._generateId();
        if (object && typeof object[methodName] === 'function') 
        { 
            if (methodName.toLowerCase().includes("onopen"))
            {   this.bindingsOnOpen.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onmessage"))
            {   this.bindingsOnMessage.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onclose"))
                {   this.bindingsOnClose.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onerror"))
                {   this.bindingsOnError.set(id, object[methodName].bind(object));     }
        }
        return id;
    }

    unbind(id) {
        if (this.bindingsOnOpen.has(id)) {    this.bindingsOnOpen.delete(id);  }
        if (this.bindingsOnMessage.has(id)) {    this.bindingsOnMessage.delete(id);  }
        if (this.bindingsOnClose.has(id)) {    this.bindingsOnClose.delete(id);  }
        if (this.bindingsOnError.has(id)) {    this.bindingsOnError.delete(id);  }
    }

    onopen(data) {
        try { this.bindingsOnOpen.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }   
    onmessage(data) {
        try { this.bindingsOnMessage.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }     
    onclose(data) {
        try { this.bindingsOnClose.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }  
    onerror(data) {
        try { this.bindingsOnError.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }  
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class Tick_WebSocketBindingManager {
    constructor(websocketUrl) {
        // singleton js
        if (Tick_WebSocketBindingManager.instance) {      return Tick_WebSocketBindingManager.instance;     }
        else {
            this.bindingsOnOpen = new Map();
            this.bindingsOnMessage = new Map();
            this.bindingsOnClose = new Map();
            this.bindingsOnError = new Map();
            this.currentId = 0
            Tick_WebSocket = new WebSocketClient({url: websocketUrl, onMessageCallback: this.onmessage.bind(this), onOpenCallback: this.onopen.bind(this), onCloseCallback: this.onclose.bind(this), onErrorCallback: this.onerror.bind(this)});
            Tick_WebSocketBindingManager.instance = this;
            return this;
        }
    }

    _generateId() {     return this.currentId++;    }
    bind(object, methodName) {
        let id = this._generateId();
        if (object && typeof object[methodName] === 'function') 
        { 
            if (methodName.toLowerCase().includes("onopen"))
            {   this.bindingsOnOpen.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onmessage"))
            {   this.bindingsOnMessage.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onclose"))
                {   this.bindingsOnClose.set(id, object[methodName].bind(object));     }
            else if (methodName.toLowerCase().includes("onerror"))
                {   this.bindingsOnError.set(id, object[methodName].bind(object));     }
        }
        return id;
    }

    unbind(id) {
        if (this.bindingsOnOpen.has(id)) {    this.bindingsOnOpen.delete(id);  }
        if (this.bindingsOnMessage.has(id)) {    this.bindingsOnMessage.delete(id);  }
        if (this.bindingsOnClose.has(id)) {    this.bindingsOnClose.delete(id);  }
        if (this.bindingsOnError.has(id)) {    this.bindingsOnError.delete(id);  }
    }

    onopen(data) {
        try { this.bindingsOnOpen.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }   
    onmessage(data) {
        try { this.bindingsOnMessage.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }     
    onclose(data) {
        try { this.bindingsOnClose.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }  
    onerror(data) {
        try { this.bindingsOnError.forEach((boundFunction, id) => {  boundFunction(data);   }); }
        catch (error) {     console.log(error);    this.unbind(id)}     }  
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class TickDatas {
    constructor({containerId, websocketUrl, websocketMgr=true, headers=["Date", "Ticker", "Price", "Quantity", "TradeId", "Ordered"], maxRecords=20,
                onMessage=null, onOpen=null, onClose=null, onError=null}) {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (Tick_WebSocket === null) {   Tick_WebSocket = new Tick_WebSocketBindingManager(websocketUrl);   }
            if (onMessage) {
                Tick_WebSocket.bind(this, "onMessageWithChildCallback"); 
                this.callbackOnMessage = onMessage;
            }
            else {
                Tick_WebSocket.bind(this, "onmessage");
            }
            if (onOpen) { Tick_WebSocket.bind(this, "onopen"); this.callbackOnOpen=onOpen; }
            if (onClose) { Tick_WebSocket.bind(this, "onclose"); this.callbackOnClose=onClose; }
            if (onError) { Tick_WebSocket.bind(this, "onerror"); this.callbackOnError=onError; }
        } else {
            this.defaultChartWebsockect = new WebSocketClient({
                                                                url: websocketUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }

        this.headers = headers;
        this.maxRecords = maxRecords;
        this.tableMain = ''; 
        this.tableBody = ''; 
        
        this.container.innerHTML = `
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------> 

<div class="container-fluid">
    
    <div class="card">	
        <div class="card-header">
    		<button type="button" class="btn btn-primary" data-toggle="collapse" data-target="#tradeDatasCollapse" aria-expanded="true">Trades :</button>
    	</div>
    	
        <div class="card-body">
    		<div id="tradeDatasCollapse" class="collapse show" style="">
                <div class="row">

                    <div class="col-sm-8">
                        <div id="volume-chart">
                            <!-- chart generated here -->
                        </div>
                    </div>

                    <div class="col-sm-12">
                        <div class="table-responsive">
                            <table id="mainTable" class="table table-striped table-bordered table-condensed">
                                <thead id="tableHead">
                                    <!-- Data will be inserted here ! -->
                                </thead>
                                <tbody id="tableBody">
                                    <!-- Data will be inserted here ! -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>			
    		</div>
    	</div>
        
    </div>

</div>

<br>
<hr>
    
<!---------------------------------------------------------------------------------------------------------------------------------------------------------------------> 
`;

        this.tableMain = this.container.querySelector("#mainTable")
        var table = '<table id="mainTable" class="table table-striped table-bordered table-condensed"><thead><tr>';
        for (let i = 0; i < this.headers.length; i++) {     table += '<th>' + this.headers[i] + '</th>';       }
        table += '</tr></thead><tbody id="tableBody"></tbody></table>';
        this.tableMain.innerHTML = table
        this.tableBody = this.container.querySelector("#tableBody");
    }

    addRow(data) { 
        const row = document.createElement('tr');
        Object.values(data).forEach(cellData => {
            const cell = document.createElement('td');
            cell.textContent = cellData;
            row.appendChild(cell);
        });
        try {
            this.tableBody.insertBefore(row, this.tableBody.firstChild);
        } catch {
            this.tableBody.appendChild(row);
        }
        if (this.tableBody.childElementCount > this.maxRecords) {this.tableBody.removeChild(this.tableBody.lastChild);} 
    }

    onmessage(data) {
        try {
            this.addRow(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    };

    onMessageWithChildCallback(data) {
        try {
            this.updateMainChart(data.price);
            this.callbackOnMessage(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    };

    onopen(event){
        this.callbackOnOpen(event);
    }

    onclose(event){
        this.callbackOnClose(event);
    }

    onerror(error){
        this.callbackOnError(error);
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class tradedVolumeChart {
    constructor({containerId, websocketUrl, websocketMgr=true, onMessage=null, onOpen=null, onClose=null, onError=null})  {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (Tick_WebSocket === null) {   Tick_WebSocket = new Tick_WebSocketBindingManager(websocketUrl);   }
            if (onMessage) {
                Tick_WebSocket.bind(this, "onMessageWithChildCallback"); 
                this.callbackOnMessage = onMessage;
            }
            else {
                Tick_WebSocket.bind(this, "onmessage");
            }
            if (onOpen) { Tick_WebSocket.bind(this, "onopen"); this.callbackOnOpen=onOpen; }
            if (onClose) { Tick_WebSocket.bind(this, "onclose"); this.callbackOnClose=onClose; }
            if (onError) { Tick_WebSocket.bind(this, "onerror"); this.callbackOnError=onError; }
        } else {
            this.defaultChartWebsockect = new WebSocketClient({
                                                                url: websocketUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }

        this.__init__();
        this.auto_resize();
    }

    __init__() {
        this.container.innerHTML = `
<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->

<div class="container-fluid">
    <div class="row">

        <div class="col-12">
            <div id="tradedVolumeChart">     
                <!-- chart generated here -->
            </div>    
        </div>

    </div>
</div>

<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->      
`;
        this.volumeSeries = null;
        this.mainChart=null
        this.chart = null;
        this.init();
    }

    no_chart() {
        if (this.mainChart===null) {return true;}
        else if (this.mainChart.children===null) {return true;}
        else if (this.mainChart.children.length === 0) {return true;}
        else {return false;}
    }

    init(data=null) {
        this.mainChart = this.container.querySelector("#tradedVolumeChart");
        if (this.no_chart()) {
            this.chart = LightweightCharts.createChart(this.mainChart, {
                with: 240,
                height: 240,
                rightPriceScale: {
                    scaleMargins: {
                        top: 0.3,
                        bottom: 0.25,
                    },
                    borderVisible: false,
                },
                timeScale: {
                    timeVisible: true,
                    lockVisibleTimeRangeOnResize: true,
                    tickMarkFormatter: (time) => {
                        let date = new Date(time);
                        return date.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })
                    },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Noraml,
                },
                layout: {
                    textColor: 'black',
                    background: { type: 'solid', color: 'white' },
                },
            });
        }

        // init price, volume and candle with historical datas
        this.volumeSeries = this.chart.addHistogramSeries();
        if (data) {this.volumeSeries.setData(data);}
    }

    updateMainChart(volume, ordered, currentTime, color=green) {
        if (ordered != "buy") {  volume *= -1;  color = red; }
        this.volumeSeries.update({'time':currentTime, 'value':volume, color: color});  
    }

    ontick(data) {
        let volume = parseFloat(Object.values(data)[2]) * parseFloat(Object.values(data)[3]);
        let ordered = Object.values(data)[5];
        let currentTime = Date.parse(Object.values(data)[0]);
        this.updateMainChart(volume=volume, ordered=ordered, currentTime);
    }

    onmessage(data) {
        try {
            this.ontick(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    };

    onMessageWithChildCallback(data) {
        try {
            this.ontick(data);
            this.callbackOnMessage(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    };

    onopen(event){
        this.callbackOnOpen(event);
    }

    onclose(event){
        this.callbackOnClose(event);
    }

    onerror(error){
        this.callbackOnError(error);
    }

    auto_resize() {
        // Adding a window resize event handler to resize the chart when
        // the window size changes.
        // Note: for more advanced examples (when the chart doesn't fill the entire window)
        // you may need to use ResizeObserver -> https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
        window.addEventListener('resize', () => {
            this.chart.resize(this.mainChart.offsetWidth, this.mainChart.offsetHeight);
        });
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        
class taIndicatorsAllChart {
    constructor({containerId, websocketUrl, websocketMgr=true, tickInterval=5, onMessage=null, onOpen=null, onClose=null, onError=null})  {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (TA_WebSocket === null) {   TA_WebSocket = new TA_WebSocketBindingManager(websocketUrl);   }
            if (onMessage) {
                TA_WebSocket.bind(this, "onMessageWithChildCallback"); 
                this.callbackOnMessage = onMessage;
            }
            else {
                TA_WebSocket.bind(this, "onmessage");
            }
            if (onOpen) { TA_WebSocket.bind(this, "onopen"); this.callbackOnOpen=onOpen; }
            if (onClose) { TA_WebSocket.bind(this, "onclose"); this.callbackOnClose=onClose; }
            if (onError) { TA_WebSocket.bind(this, "onerror"); this.callbackOnError=onError; }
        } else {
            this.taIndicatorsAllChartWebsockect = new WebSocketClient({
                                                                url: websocketUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }
        this.tickInterval = tickInterval;
        this.__init__();
        this.auto_resize();
    }

    __init__() {
        this.container.innerHTML = `
<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->

<div class="container-fluid">
    <div class="row">

        <div class="col-12">
            <div id="taIndicatorsAllChart">     
                <!-- chart generated here -->
            </div>    
        </div>

    </div>
</div>

<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->      
`;
        this.candleSeries = null;  
        this.ticksInCurrentBar = 0;
        this.currentBar = {
            open: null,
            high: null,
            low: null,
            close: null,
            time: this.getCurrentTime(),
        };
        this.mainChart=null
        this.chart = null;
        this.updateMainChart = this.updateMainChartAndInit;
        this.init();
    }

    getCurrentTime() {
        return Math.floor(Date.now());
    }


    no_chart() {
        if (this.mainChart===null) {return true;}
        else if (this.mainChart.children===null) {return true;}
        else if (this.mainChart.children.length === 0) {return true;}
        else {return false;}
    }

    init(data=null) {
        this.mainChart = this.container.querySelector("#taIndicatorsAllChart");
        if (this.no_chart()) {
            this.chart = LightweightCharts.createChart(this.mainChart, {
                with: 240,
                height: 240,
                rightPriceScale: {
                    autoScale: true,
                    scaleMargins: {
                        top: 0.3,
                        bottom: 0.25,
                    },
                    borderVisible: false,
                },
                timeScale: {
                    timeVisible: true,
                    lockVisibleTimeRangeOnResize: true,
                    tickMarkFormatter: (time) => {
                        const date = new Date(time);
                        return date.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })
                    },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Noraml,
                },
                layout: {
                    textColor: 'black',
                    background: { type: 'solid', color: 'white' },
                },
            });
        }
        
        // init price, volume and candle with historical datas
        this.candleSeries = this.chart.addCandlestickSeries();
        if (data) {this.candleSeries.setData(data);}
    };

    mergeTickToBar(price, date) {
        // create candle
        if (this.currentBar.open === null) {              
            this.currentBar.open = price;
            this.currentBar.high = price;
            this.currentBar.low = price;
            this.currentBar.close = price;
            this.currentBar.time = date;
        } else {
            this.currentBar.close = price;
            this.currentBar.high = Math.max(this.currentBar.high, price);
            this.currentBar.low = Math.min(this.currentBar.low, price);
        }
        this.candleSeries.update(this.currentBar);
    }

    updateMainChart(price, date) {
    }

    updateMainChartAndInit(price, date) {
        let precision = price.toString().split(".")[1].length || 0;
        this.candleSeries.applyOptions({    priceFormat: { type: 'price', precision: precision, minMove: Math.pow(10, -precision), }     });
        this.updateMainChartOnly(price, date);
        this.updateMainChart = this.updateMainChartOnly;
    }

    updateMainChartOnly(price, date) {
        this.mergeTickToBar(price, (date*1000));
        if (++this.ticksInCurrentBar === this.tickInterval) {
            this.currentBar = {
                open: null,
                high: null,
                low: null,
                close: null,
                time: null,
            };
            this.ticksInCurrentBar = 0;
        }
    }

    onmessage(data) {
        try {
            this.updateMainChart(data.price, data.date);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallback(data) {
        try {
            this.updateMainChart(data.price, data.date);
            this.callbackOnMessage(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    }

    onopen(event){
        this.callbackOnOpen(event);
    }

    onclose(event){
        this.callbackOnClose(event);
    }

    onerror(error){
        this.callbackOnError(error);
    }

    auto_resize() {
        // Adding a window resize event handler to resize the chart when
        // the window size changes.
        // Note: for more advanced examples (when the chart doesn't fill the entire window)
        // you may need to use ResizeObserver -> https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
        window.addEventListener('resize', () => {
            this.chart.resize(this.mainChart.offsetWidth, this.mainChart.offsetHeight);
        });
    }

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class patternChart {
    constructor({containerId, websocketUrl, talib_function_groups, websocketMgr=true, tickInterval=5, onMessage=null, onOpen=null, onClose=null, onError=null})  {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (TA_WebSocket === null) {   TA_WebSocket = new TA_WebSocketBindingManager(websocketUrl);   }
            if (onMessage) {
                TA_WebSocket.bind(this, "onMessageWithChildCallback"); 
                this.callbackOnMessage = onMessage;
            }
            else {
                TA_WebSocket.bind(this, "onmessage");
            }
            if (onOpen) { TA_WebSocket.bind(this, "onopen"); this.callbackOnOpen=onOpen; }
            if (onClose) { TA_WebSocket.bind(this, "onclose"); this.callbackOnClose=onClose; }
            if (onError) { TA_WebSocket.bind(this, "onerror"); this.callbackOnError=onError; }
        } else {
            this.taIndicatorsAllChartWebsockect = new WebSocketClient({
                                                                url: websocketUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }
        this.tickInterval = tickInterval;
        this.talib_function_groups = talib_function_groups['Pattern Recognition'];
        this.__init__();
        this.auto_resize();
    }

    __init__() {
        this.container.innerHTML = `
<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->

<div class="container-fluid">

    <div id="patternChart" class="card"> 

        <div class="card-header">
            <button type="button" class="btn btn-primary" data-toggle="collapse" data-target="#patternsCollapse" aria-expanded="true">Patterns :</button>
        </div>

        <div class="card-body">
    		<div id="patternsCollapse" class="collapse show" style="">
                <div class="row">        

                    <div class="col-sm-8">
                        <div id="main-chart">
                            <!-- chart generated here -->
                        </div>
                    </div>

                    <div class="col-sm-4">
                        <div id="patterns">
                            <table class="table-responsive" id="TablePatterns">
                                <thead>
                                    <tr>
                                        <th scope="col" class="text-left">Pattern Recognition</th>
                                        <th scope="col"></th>
                                    </tr>
                                </thead>
                                <tbody id="tablePatterns" class="text-left">
                                </tbody> 
                            </table>
                        </div>
                    </div>

                </div>
            </div>    
        </div>

    </div>

</div>

<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->      
`;
        this.candleSeries = null;  
        this.ticksInCurrentBar = 0;
        this.currentBar = {
            open: null,
            high: null,
            low: null,
            close: null,
            time: this.getCurrentTime(),
        };
        this.mainChart=null;
        this.chart = null;
        this.updateMainChart = this.updateMainChartAndInit;
        this.init();
    }

    getCurrentTime() {
        return Math.floor(Date.now());
    }


    no_chart() {
        if (this.mainChart===null) {return true;}
        else if (this.mainChart.children===null) {return true;}
        else if (this.mainChart.children.length === 0) {return true;}
        else {return false;}
    }

    init(data=null) {
        this.mainChart = this.container.querySelector("#main-chart");
        if (this.no_chart()) {
            this.chart = LightweightCharts.createChart(this.mainChart, {
                with: 240,
                height: 240,
                rightPriceScale: {
                    scaleMargins: {
                        top: 0.3,
                        bottom: 0.25,
                    },
                    borderVisible: false,
                },
                timeScale: {
                    timeVisible: true,
                    lockVisibleTimeRangeOnResize: true,
                    tickMarkFormatter: (time) => {
                        const date = new Date(time);
                        return date.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })
                    },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Noraml,
                },
                layout: {
                    textColor: 'black',
                    background: { type: 'solid', color: 'white' },
                },
            });
        }
        
        // init price, vloume and candle with historical datas
        this.candleSeries = this.chart.addCandlestickSeries();
        if (data) {this.candleSeries.setData(data);}
    }

    mergeTickToBar(price, date) {
        // create candle
        if (this.currentBar.open === null) {              
            this.currentBar.open = price;
            this.currentBar.high = price;
            this.currentBar.low = price;
            this.currentBar.close = price;
            this.currentBar.time = date;
        } else {
            this.currentBar.close = price;
            this.currentBar.high = Math.max(this.currentBar.high, price);
            this.currentBar.low = Math.min(this.currentBar.low, price);
        }
        //candleSeries.createPriceLine(myPriceLine);
        this.candleSeries.update(this.currentBar);
    }

    updateMainChart(price, date) {
    }

    updateMainChartAndInit(price, date) {
        let precision = price.toString().split(".")[1].length || 0;
        this.candleSeries.applyOptions({    priceFormat: { type: 'price', precision: precision, minMove: Math.pow(10, -precision), }     });
        this.updateMainChartOnly(price, date);
        this.updateMainChart = this.updateMainChartOnly;
    }

    updateMainChartOnly(price, date) {
        this.mergeTickToBar(price, (date*1000));
        if (++this.ticksInCurrentBar === this.tickInterval) {
            this.currentBar = {
                open: null,
                high: null,
                low: null,
                close: null,
                time: null,
            };
            this.ticksInCurrentBar = 0;
        }
    }

    containsAny(str) {  return this.talib_function_groups.find(element => `stream_${element}` === str);   }
    pattern(datas) {
        const tableBody = this.container.querySelector("#tablePatterns");
        tableBody.innerHTML='';
        for (let key in datas) {
            if (this.containsAny(key) && datas[key]!==0) {
                let i = 0;
                let row = tableBody.insertRow();
                let cellPattern = row.insertCell(i++); cellPattern.classList.add('blink'); cellPattern.textContent = key;
                let cellPatternVal = row.insertCell(i++); cellPatternVal.classList.add('blink'); cellPatternVal.textContent = datas[key];
            }
        }
    }

    onmessage(data) {
        try {
            this.updateMainChart(data.price, data.date);
            this.pattern(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallback(data) {
        try {
            this.updateMainChart(data.price, data.date);
            this.pattern(data);
            this.callbackOnMessage(data);
        } 
        catch (error) {
            this.onerror(error);
            //throw new Error(error);
        }
    }

    onopen(event){
        this.callbackOnOpen(event);
    }

    onclose(event){
        this.callbackOnClose(event);
    }

    onerror(error){
        this.callbackOnError(error);
    }

    auto_resize() {
        // Adding a window resize event handler to resize the chart when
        // the window size changes.
        // Note: for more advanced examples (when the chart doesn't fill the entire window)
        // you may need to use ResizeObserver -> https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
        window.addEventListener('resize', () => {
            this.chart.resize(this.mainChart.offsetWidth, this.mainChart.offsetHeight);
        });
    }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class volumeChart {
    constructor({containerId, websocketTickUrl, websocketTaUrl, talib_function_groups, websocketMgr=true, tickInterval=5, onMessage=null, onOpen=null, onClose=null, onError=null})  {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (Tick_WebSocket === null) {   Tick_WebSocket = new Tick_WebSocketBindingManager(websocketTickUrl);   }
                if (onMessage) {
                    Tick_WebSocket.bind(this, "onMessageWithChildCallbackTick"); 
                    this.callbackOnMessageTick = onMessage;
                }
                else {
                    Tick_WebSocket.bind(this, "onmessageTick");
                }
                if (onOpen) { Tick_WebSocket.bind(this, "onopenTick"); this.callbackOnOpenTick=onOpen; }
                if (onClose) { Tick_WebSocket.bind(this, "oncloseTick"); this.callbackOnCloseTick=onClose; }
                if (onError) { Tick_WebSocket.bind(this, "onerrorTick"); this.callbackOnErrorTick=onError; }

            if (TA_WebSocket === null) {   TA_WebSocket = new TA_WebSocketBindingManager(websocketTaUrl);   }
                if (onMessage) {
                    TA_WebSocket.bind(this, "onMessageWithChildCallbackTa"); 
                    this.callbackOnMessageTa = onMessage;
                }
                else {
                    TA_WebSocket.bind(this, "onmessageTa");
                }
                if (onOpen) { TA_WebSocket.bind(this, "onopenTa"); this.callbackOnOpenTa=onOpen; }
                if (onClose) { TA_WebSocket.bind(this, "oncloseTa"); this.callbackOnCloseTa=onClose; }
                if (onError) { TA_WebSocket.bind(this, "onerrorTa"); this.callbackOnErrorTa=onError; }
        } else {
            this.defaultChartWebsockect = new WebSocketClient({
                                                                url: websocketTickUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }
        this.tickInterval = tickInterval;
        this.talib_function_groups = talib_function_groups['Volume Indicators'];
        this.__init__();
        this.auto_resize();
    }


    __init__() {
        this.container.innerHTML = `
<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->

<div class="container-fluid">

    <div id="volumeChart" class="card"> 

        <div class="card-header">
            <button type="button" class="btn btn-primary" data-toggle="collapse" data-target="#volumeCollapse" aria-expanded="true">Volumes :</button>
        </div>

        <div class="card-body">
    		<div id="volumeCollapse" class="collapse show" style="">
                <div class="row">        

                    <div class="col-sm-8">
                        <div id="volume-chart">
                            <!-- chart generated here -->
                        </div>
                    </div>

                    <div class="col-sm-4">
                        <div id="volume">
                            <table class="table-responsive" id="TableVolume">
                                <thead>
                                    <tr>
                                        <th scope="col" class="text-left">Volume Indicators</th>
                                        <th scope="col"></th>
                                    </tr>
                                </thead>
                                <tbody id="tableVolume" class="text-left">
                                </tbody> 
                            </table>
                        </div>
                    </div>

                </div>
            </div>    
        </div>

    </div>

</div>

<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->      
`;
        this.volumeSeries = null;
        this.mainChart=null;
        this.chart = null;
        this.updateMainChart = this.updateMainChartAndInit;
        this.init();
    }

    getCurrentTime() {
        return Math.floor(Date.now());
    }


    no_chart() {
        if (this.mainChart===null) {return true;}
        else if (this.mainChart.children===null) {return true;}
        else if (this.mainChart.children.length === 0) {return true;}
        else {return false;}
    }

    init(data=null) {
        this.mainChart = this.container.querySelector("#volume-chart");
        if (this.no_chart()) {
            this.chart = LightweightCharts.createChart(this.mainChart, {
                with: 240,
                height: 240,
                rightPriceScale: {
                    scaleMargins: {
                        top: 0.3,
                        bottom: 0.25,
                    },
                    borderVisible: false,
                },
                timeScale: {
                    timeVisible: true,
                    lockVisibleTimeRangeOnResize: true,
                    tickMarkFormatter: (time) => {
                        const date = new Date(time);
                        return date.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })
                    },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Noraml,
                },
                layout: {
                    textColor: 'black',
                    background: { type: 'solid', color: 'white' },
                },
            });
        }
        
        // init price, volume and candle with historical datas
        this.volumeSeries = this.chart.addHistogramSeries();
        if (data) {this.volumeSeries.setData(data);}
    }

    updateMainChar(volume, ordered, currentTime, color=green) {
        if (ordered != "buy") {  volume *= -1;  color = red; }
        this.volumeSeries.update({'time':currentTime, 'value':volume, color: color});  
    }

    ontick(data) {
        let volume = parseFloat(Object.values(data)[2]) * parseFloat(Object.values(data)[3]);
        let ordered = Object.values(data)[5];
        let currentTime = Date.parse(Object.values(data)[0]);
        this.updateMainChar(volume=volume, ordered=ordered, currentTime);
    }

    containsAny(str) {  return this.talib_function_groups.find(element => `stream_${element}` === str);   }
    volume(datas) {
        const tableBody = this.container.querySelector("#tableVolume");
        tableBody.innerHTML='';
        for (let key in datas) {
            if (this.containsAny(key)) {
                let i = 0;
                let row = tableBody.insertRow();
                let cellPattern = row.insertCell(i++); cellPattern.classList.add('blink'); cellPattern.textContent = key;
                let cellPatternVal = row.insertCell(i++); cellPatternVal.classList.add('blink'); cellPatternVal.textContent = datas[key];
            }
        }
    }

    onmessageTa(data) {
        try {
            this.volume(data);
        } 
        catch (error) {
            this.onerrorTa(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallbackTa(data) {
        try {
            this.volume(data);
            this.callbackOnMessageTa(data);
        } 
        catch (error) {
            this.onerrorTa(error);
            //throw new Error(error);
        }
    }

    onopenTa(event){
        this.callbackOnOpenTa(event);
    }

    oncloseTa(event){
        this.callbackOnCloseTa(event);
    }

    onerrorTa(error){
        this.callbackOnErrorTa(error);
    }

    onmessageTick(data) {
        try {
            this.ontick(data);
        } 
        catch (error) {
            this.onerrorTick(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallbackTick(data) {
        try {
            this.ontick(data);
            this.callbackOnMessageTick(data);
        } 
        catch (error) {
            this.onerrorTick(error);
            //throw new Error(error);
        }
    }

    onopenTick(event){
        this.callbackOnOpenTick(event);
    }

    oncloseTick(event){
        this.callbackOnCloseTick(event);
    }

    onerrorTick(error){
        this.callbackOnErrorTick(error);
    }

    auto_resize() {
        // Adding a window resize event handler to resize the chart when
        // the window size changes.
        // Note: for more advanced examples (when the chart doesn't fill the entire window)
        // you may need to use ResizeObserver -> https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
        window.addEventListener('resize', () => {
            this.chart.resize(this.mainChart.offsetWidth, this.mainChart.offsetHeight);
        });
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


class volatilityChart {
    constructor({containerId, websocketTickUrl, websocketTaUrl, talib_function_groups, websocketMgr=true, tickInterval=5, onMessage=null, onOpen=null, onClose=null, onError=null})  {
        this.container = document.getElementById(containerId);
        if (websocketMgr) {
            if (Tick_WebSocket === null) {   Tick_WebSocket = new Tick_WebSocketBindingManager(websocketTickUrl);   }
                if (onMessage) {
                    Tick_WebSocket.bind(this, "onMessageWithChildCallbackTick"); 
                    this.callbackOnMessageTick = onMessage;
                }
                else {
                    Tick_WebSocket.bind(this, "onmessageTick");
                }
                if (onOpen) { Tick_WebSocket.bind(this, "onopenTick"); this.callbackOnOpenTick=onOpen; }
                if (onClose) { Tick_WebSocket.bind(this, "oncloseTick"); this.callbackOnCloseTick=onClose; }
                if (onError) { Tick_WebSocket.bind(this, "onerrorTick"); this.callbackOnErrorTick=onError; }

            if (TA_WebSocket === null) {   TA_WebSocket = new TA_WebSocketBindingManager(websocketTaUrl);   }
                if (onMessage) {
                    TA_WebSocket.bind(this, "onMessageWithChildCallbackTa"); 
                    this.callbackOnMessageTa = onMessage;
                }
                else {
                    TA_WebSocket.bind(this, "onmessageTa");
                }
                if (onOpen) { TA_WebSocket.bind(this, "onopenTa"); this.callbackOnOpenTa=onOpen; }
                if (onClose) { TA_WebSocket.bind(this, "oncloseTa"); this.callbackOnCloseTa=onClose; }
                if (onError) { TA_WebSocket.bind(this, "onerrorTa"); this.callbackOnErrorTa=onError; }
        } else {
            this.defaultChartWebsockect = new WebSocketClient({
                                                                url: websocketTickUrl,   
                                                                onMessageCallback: onMessage===null ? this.onmessage.bind(this) : this.onMessageWithChildCallback.bind(this), 
                                                                onOpenCallback: this.onopen.bind(this), 
                                                                onCloseCallback: this.onclose.bind(this), 
                                                                onErrorCallback: this.onerror.bind(this)
                                                            });
            if (onMessage) { this.callbackOnMessage=onMessage; }
            if (onOpen) { this.callbackOnOpen=onOpen; }
            if (onClose) { this.callbackOnClose=onClose; }
            if (onError) { this.callbackOnError=onError; }            
        }
        this.tickInterval = tickInterval;
        this.talib_function_groups = talib_function_groups['Volatility Indicators'];
        this.updateMainChart = this.updateMainChartAndInit;
        this.__init__();
        this.auto_resize();
    }


    __init__() {
        this.container.innerHTML = `
<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->

<div class="container-fluid">

    <div id="volatilityChart" class="card"> 

        <div class="card-header">
            <button type="button" class="btn btn-primary" data-toggle="collapse" data-target="#volatilityCollapse" aria-expanded="true">Volatility :</button>
        </div>

        <div class="card-body">
    		<div id="volatilityCollapse" class="collapse show" style="">
                <div class="row">        

                    <div class="col-sm-8">
                        <div id="volatility-chart">
                            <!-- chart generated here -->
                        </div>
                    </div>

                    <div class="col-sm-4">
                        <div id="volatility">
                            <table class="table-responsive" id="TableVolatility">
                                <thead>
                                    <tr>
                                        <th scope="col" class="text-left">Volatility Indicators</th>
                                        <th scope="col"></th>
                                    </tr>
                                </thead>
                                <tbody id="tableVolatility" class="text-left">
                                </tbody> 
                            </table>
                        </div>
                    </div>

                </div>
            </div>    
        </div>

    </div>

</div>

<!--------------------------------------------------------------------------------------------------------------------------------------------------------------------->      
`;
        this.volatilitySeries = null;
        this.mainChart=null
        this.chart = null;
        this.init();
    }

    getCurrentTime() {
        return Math.floor(Date.now());
    }

    no_chart() {
        if (this.mainChart===null) {return true;}
        else if (this.mainChart.children===null) {return true;}
        else if (this.mainChart.children.length === 0) {return true;}
        else {return false;}
    }

    init(data=null) {
        this.mainChart = this.container.querySelector("#volatility-chart");
        if (this.no_chart()) {
            this.chart = LightweightCharts.createChart(this.mainChart, {
                with: 240,
                height: 240,
                rightPriceScale: {
                    scaleMargins: {
                        top: 0.3,
                        bottom: 0.25,
                    },
                    borderVisible: false,
                },
                timeScale: {
                    timeVisible: true,
                    lockVisibleTimeRangeOnResize: true,
                    tickMarkFormatter: (time) => {
                        const date = new Date(time);
                        return date.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'UTC'
                        })
                    },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Noraml,
                },
                layout: {
                    textColor: 'black',
                    background: { type: 'solid', color: 'white' },
                },
            });
        }
        
        // init price and candle with historical datas
        this.priceSeries = this.chart.addLineSeries({ color: 'black', lineWidth: 1 });
        if (data) {this.priceSeries.setData(data);}
    }

    updateMainChart(currentPrice, currentTim) {
    }

    updateMainChartAndInit(currentPrice, currentTime) {
        let precision = currentPrice.toString().split(".")[1].length || 0;
        this.priceSeries.applyOptions({    priceFormat: { type: 'price', precision: precision, minMove: Math.pow(10, -precision), }     });
        this.updateMainChartOnly(currentPrice, currentTime);
        this.updateMainChart = this.updateMainChartOnly;
    }

    updateMainChartOnly(currentPrice, currentTime, color=green) {
        this.priceSeries.update({ time: currentTime, value: currentPrice});
    }

    ontick(data) {
        let currentPrice = Object.values(data)[2];
        let currentTime = Date.parse(Object.values(data)[0]);
        this.updateMainChart(currentPrice=currentPrice, currentTime=currentTime);
    }

    containsAny(str) {  return this.talib_function_groups.find(element => `stream_${element}` === str);   }
    volatility(datas) {
        const tableBody = this.container.querySelector("#tableVolatility");
        tableBody.innerHTML='';
        for (let key in datas) {
            if (this.containsAny(key)) {
                let i = 0;
                let row = tableBody.insertRow();
                let cellPattern = row.insertCell(i++); cellPattern.classList.add('blink'); cellPattern.textContent = key;
                let cellPatternVal = row.insertCell(i++); cellPatternVal.classList.add('blink'); cellPatternVal.textContent = datas[key];
            }
        }
    }

    onmessageTa(data) {
        try {
            this.volatility(data);
        } 
        catch (error) {
            this.onerrorTa(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallbackTa(data) {
        try {
            this.volatility(data);
            this.callbackOnMessageTa(data);
        } 
        catch (error) {
            this.onerrorTa(error);
            //throw new Error(error);
        }
    }

    onopenTa(event){
        this.callbackOnOpenTa(event);
    }

    oncloseTa(event){
        this.callbackOnCloseTa(event);
    }

    onerrorTa(error){
        this.callbackOnErrorTa(error);
    }

    onmessageTick(data) {
        try {
            this.ontick(data);
        } 
        catch (error) {
            this.onerrorTick(error);
            //throw new Error(error);
        }
    }

    onMessageWithChildCallbackTick(data) {
        try {
            this.ontick(data);
            this.callbackOnMessageTick(data);
        } 
        catch (error) {
            this.onerrorTick(error);
            //throw new Error(error);
        }
    }

    onopenTick(event){
        this.callbackOnOpenTick(event);
    }

    oncloseTick(event){
        this.callbackOnCloseTick(event);
    }

    onerrorTick(error){
        this.callbackOnErrorTick(error);
    }

    auto_resize() {
        // Adding a window resize event handler to resize the chart when
        // the window size changes.
        // Note: for more advanced examples (when the chart doesn't fill the entire window)
        // you may need to use ResizeObserver -> https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
        window.addEventListener('resize', () => {
            this.chart.resize(this.mainChart.offsetWidth, this.mainChart.offsetHeight);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


export { TickDatas, tradedVolumeChart, taIndicatorsAllChart, patternChart, volumeChart, volatilityChart };