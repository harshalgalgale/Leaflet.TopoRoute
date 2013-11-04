L.Mixin.ActivableControl = {
    activable: function (state) {
        this._activable = state === undefined ? true : !!state;
        if (this._container) {
            if (state)
                L.DomUtil.removeClass(this._container, 'leaflet-disabled');
            else
                L.DomUtil.addClass(this._container, 'leaflet-disabled');
        }
    },

    activate: function () {
        if (!!!this._activable)
            return;  // do nothing if not activable

        this.handler.enable();
        L.DomUtil.addClass(this._container, 'active');
    },

    deactivate: function () {
        this.handler.disable();
        L.DomUtil.removeClass(this._container, 'active');
    },

    toggle: function() {
        if (this.handler.enabled())
            this.deactivate();
        else
            this.activate();
    },
};


L.Control.TopoRouteControl = L.Control.extend({

    includes: L.Mixin.ActivableControl,

    statics: {
        TITLE: 'Route',
        LABEL: 'o',
    },

    initialize: function (options) {
        L.Control.prototype.initialize.call(this, options);
        this.handler = null;
        this.router = null;
    },

    onAdd: function (map) {
        if (this._map.almostOver === undefined) {
            throw 'Leaflet.AlmostOver required.';
        }
        this.router = new L.TopoRouter(map);
        this.handler = new L.Handler.TopoRouteHandler(map);
        this.handler.on('ready', this.activable, this);
        this.handler.on('toporoute:compute', function (e) {
            this.router.compute(e.start, e.end, e.vias);
            this._map.spin(true);
        }, this);
        this.router.on('computed', function (e) {
            this.handler.setResult(e.result);
            this._map.spin(false);
        }, this);
        return this._initContainer();
    },

    _initContainer: function () {
        var zoomName = 'leaflet-control-toporoute leaflet-control-zoom leaflet-disabled',
            barName = 'leaflet-bar',
            partName = barName + '-part',
            container = L.DomUtil.create('div', zoomName + ' ' + barName);
        var link = L.DomUtil.create('a', zoomName + '-in ' + partName, container);
        link.innerHTML = L.Control.TopoRouteControl.LABEL;
        link.href = '#';
        link.title = L.Control.TopoRouteControl.TITLE;
        this._button = link;

        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(link, 'click', stop)
            .on(link, 'mousedown', stop)
            .on(link, 'dblclick', stop)
            .on(link, 'click', L.DomEvent.preventDefault)
            .on(link, 'click', function (e) {
                this.toggle();
            }, this);
        return container;
    },
});


L.Handler.TopoRouteHandler = L.Handler.extend({

    includes: L.Mixin.Events,

    initialize: function (map) {
        L.Handler.prototype.initialize.call(this, map);
        this.polylineHandles = null;
        this._pathsLayer = null;
        this._start = null;
        this._end = null;
        this._vias = [];
    },

    addHooks: function () {
        if (!this._pathsLayer)
            return;

        this.polylineHandles.enable();
        this._map.almostOver.enable();
    },

    removeHooks: function () {
        if (!this._pathsLayer)
            return;

        this.polylineHandles.disable();
    },

    setPathsLayer: function (pathsLayer) {
        this._pathsLayer = pathsLayer;
        if ((pathsLayer.getLayers()).length > 0) {
            this._onPathLoaded();
        }
        this._pathsLayer.on('data:loaded', this._onPathLoaded, this);
    },

    _onPathLoaded: function () {
        this._map.almostOver.addLayer(this._pathsLayer);

        this.polylineHandles = this._pathsLayer.getLayers()[0].polylineHandles;
        this.polylineHandles.addGuideLayer(this._pathsLayer);
        this.polylineHandles.on('attach', this._onAttached, this);
        this.polylineHandles.on('detach', this._onDetached, this);
        this.polylineHandles.options.markerFactory = this._getHandleMarker.bind(this);

        this.fire('ready');
    },

    _getHandleMarker: function (latlng) {
        var className = 'handle-icon';
        if (!this._start)
            className = 'marker-source';
        else if (!this._end)
            className = 'marker-target';
        var handleIcon = L.divIcon({className: className});
        return L.marker(latlng, {icon: handleIcon});
    },

    _onAttached: function (e) {
        var marker = e.marker,
            latlng = marker.getLatLng();

        marker.attached = e.layer;

        if (!this._start) {
            this._start = marker;
        }
        else if (!this._end) {
            this._end = marker;
        }
        else {
            // Add to Vias using result route index
            this._vias.splice(marker.index, 0, marker);
        }
        if (this._start && this._end) {
            this._computeRoute();
        }
        this.polylineHandles.refreshMarker();
    },

    _onDetached: function (e) {
        if (this._end === e.marker) {
            this._end = null;
        }
        else if (this._start === e.marker) {
            this._start = null;
        }
        else {
            // Remove from Via
            var index = this._vias.indexOf(e.marker);
            this._vias.splice(index, 1);
        }
        if (this._start && this._end) {
            this._computeRoute();
        }
        else {
            this.setResult(null);
        }
        this.polylineHandles.refreshMarker();
    },

    _computeRoute: function () {
        var data = {
            start: {latlng: this._start.getLatLng(),
                    layer: this._start.attached},
            end: {latlng: this._end.getLatLng(),
                  layer: this._end.attached},
            vias: []
        };
        for (var i=0, n=this._vias.length; i<n; i++) {
            data.vias.push({latlng: this._vias[i].getLatLng(),
                            layer: this._vias[i].attached});
        }
        this.fire('toporoute:compute', data);
    },

    setResult: function (result) {
        if (this._result) {
            this._map.almostOver.removeLayer(this._result);
            this._map.removeLayer(this._result);
            this._result = null;
        }

        if (result) {
            this._map.almostOver.removeLayer(this._pathsLayer);
            this.polylineHandles.options.attachOnClick = false;

            this._result = L.featureGroup();
            this._result.addTo(this._map);
            for (var i=0; i<result.layers.length; i++) {
                var route = result.layers[i];
                this._result.addLayer(route);
                this._map.almostOver.addLayer(route);
                // Keep route index to insert via step
                route.on('grab', (function (index) {
                    return function (e) {
                        e.marker.index = index;
                    };
                })(i));
            }

            // Apparence
            this._result.setStyle({weight: 8,
                                   opacity: 0.7,
                                   color: 'yellow'});
            if (typeof this._result.setText == 'function') {
                this._result.setText(' ► ', {repeat: true,
                                             offset: 4,
                                             attributes: {'font-size': '12',
                                                          'fill-opacity': '0.5',
                                                          'fill': 'orange'}});
            }
        }
        else {
            this._map.almostOver.addLayer(this._pathsLayer);
            this.polylineHandles.options.attachOnClick = true;
        }
    },
});


L.TopoRouter = L.Class.extend({

    includes: L.Mixin.Events,

    initialize: function () {
        this._graph = null;
        this._data = null;
    },

    setGraph: function (data) {
        this._data = data;

        var input = {};
        for (var node in data.nodes) {
            input[node] = {};
            var dests = data.nodes[node];
            for (var dest in dests) {
                var edgeid = data.nodes[node][dest],
                    edge = data.edges[edgeid];
                input[node][dest] = edge.length;
            }
        }
        this._graph = new Graph(input);
    },

    compute: function (start, end, vias) {
        var layers = [];
        vias = vias || [];
        if (vias.length === 0) {
            var shortest = this._shortestPath(start, end);
            layers.push(shortest.layer);
        }
        else {
            var shortest = this._shortestPath(start, vias[0]);
            layers.push(shortest.layer);
            for (var i=0, n=vias.length-1; i<n; i++) {
                shortest = this._shortestPath(vias[i], vias[i++]);
                layers.push(shortest.layer);
            }
            shortest = this._shortestPath(vias[vias.length-1], end);
            layers.push(shortest.layer);
        }

        var result = {
            layers: layers
        };
        this.fire('computed', {result: result});
        return result;
    },

    _shortestPath: function (start, end) {
        return {layer: null};
    }
});
