// searchBar.js

import WebSocketClient from './websocket.js';

class searchBar {
    constructor(containerId, cacheDataEndPoint, callback) {
        this.container = document.getElementById(containerId, cacheDataEndPoint);
        if (typeof(cacheDataEndPoint) == "object") {  this.searchable_WebSocket = new WebSocketClient(websocketUrl, this.onmessage.bind(this));  }
        else {   this.searchable_WebSocket = cacheDataEndPoint   }
        this.style = document.createElement('style');
        this.callback = callback;
        this.style.innerHTML = `
            .autocomplete-items {
                position: absolute;
                z-index: 100;
                top: 100%;
                left: 0;
                right: 0;
                background-color: #fff;
            }
            .autocomplete-items div {
                padding: 10px;
                text-align: left;
                cursor: pointer;
            }
            .autocomplete-items div:hover {
                background-color: #e9e9e9;
            }
            .autocomplete-active {
                background-color: DodgerBlue !important;
                color: #ffffff;
            }
        `
        document.head.appendChild(this.style);
        this.container.innerHTML = `
        <div class="container mt-4">
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <form autocomplete="off" action="/searchBar" method="get" class="input-group">
                        <input id="searchBar" class="form-control" placeholder="Search..." aria-label="Search" autocomplete="off";>
                        <div class="input-group-append">
                            <button id="submit_go" class="btn btn-primary" type="submit">Go !</button>
                        </div>
                        <div id="autocomplete-list" class="autocomplete-items"></div>
                    </form>
                    <div id="hidden-suggestions" hidden></div>
                </div>
            </div>
        </div>
        `;
        if ((!cacheDataEndPoint.startsWith('/')) &&  (!cacheDataEndPoint.startsWith('http'))) {
            cacheDataEndPoint = `/${cacheDataEndPoint}`;
        }
        this.submit_go = this.container.querySelector('#submit_go');
        this.eventListenerStart(cacheDataEndPoint);
    }

    closeAllLists(elmnt = null) {
        const x = this.container.querySelectorAll(".autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt !== x[i] && elmnt !== this.inputElement) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }

    autocomplete(inp, arr) {
        let currentFocus;
        this.closeAllLists();
        if (!inp.value) return false;
        currentFocus = -1;

        const a = document.createElement("div");
        a.setAttribute("id", inp.id + "-autocomplete-list");
        a.setAttribute("class", "autocomplete-items input-group");
        a.setAttribute("style", "z-index:99;");
        inp.parentNode.appendChild(a);

        const query = inp.value.toLowerCase();

        for (let i = 0; i < arr.length; i++) {
            if (arr[i].toLowerCase().includes(query)) {
                const b = document.createElement("div");
                const matchIndex = arr[i].toLowerCase().indexOf(query);
                b.innerHTML = arr[i].substr(0, matchIndex) + "<strong>" + arr[i].substr(matchIndex, query.length) + "</strong>" + arr[i].substr(matchIndex + query.length);
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                b.addEventListener("click", (e) => {
                    inp.value = e.target.getElementsByTagName("input")[0].value;
                    this.closeAllLists();
                });
                a.appendChild(b);
            }
        }
    }

    addActive(x) {
        if (!x) return false;
        this.removeActive(x);
        if (this.currentFocus >= x.length) this.currentFocus = 0;
        if (this.currentFocus < 0) this.currentFocus = (x.length - 1);
        x[this.currentFocus].classList.add("autocomplete-active");
    }

    removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    onmessage(data) {
        fetch(`${cacheDataEndPoint}`)
            .then(response => response.json())
            .then(data => {
                this.hiddenDiv = this.container.querySelector('#hidden-suggestions');
                this.hiddenDiv.textContent = JSON.stringify(data);
            });

        this.inputElement = this.container.querySelector('#searchBar');
        this.inputElement.addEventListener("input", () => {
            const suggestions = JSON.parse(this.hiddenDiv.textContent);
            const query = this.inputElement.value.toLowerCase();
            const filteredSuggestions = suggestions.filter(item => item.toLowerCase().includes(query));
            this.autocomplete(this.inputElement, filteredSuggestions);
        });
    }

    eventListenerStart(cacheDataEndPoint) {
        document.addEventListener("DOMContentLoaded", () => {
            fetch(`${cacheDataEndPoint}`)
                .then(response => response.json())
                .then(data => {
                    this.hiddenDiv = this.container.querySelector('#hidden-suggestions');
                    this.hiddenDiv.textContent = JSON.stringify(data);
                });

            this.inputElement = this.container.querySelector('#searchBar');
            this.inputElement.addEventListener("input", () => {
                const suggestions = JSON.parse(this.hiddenDiv.textContent);
                const query = this.inputElement.value.toLowerCase();
                const filteredSuggestions = suggestions.filter(item => item.toLowerCase().includes(query));
                this.autocomplete(this.inputElement, filteredSuggestions);
            });
        });

        document.addEventListener("click", (e) => {
            this.closeAllLists(e.target);
        });

        this.submit_go.addEventListener("click", (e) => {
            e.preventDefault();
            this.callback(this.inputElement);
        });

    }
}

export default searchBar;