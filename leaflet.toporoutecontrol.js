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
    },

    onAdd: function (map) {
        if (this._map.almostOver === undefined) {
            throw 'Leaflet.AlmostOver required.';
        }
        this.handler = new L.Handler.TopoRouteHandler(map);
        this.handler.on('ready', this.activable, this);
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
        this._pathsLayer = null;
        this._result = null;
    },

    addHooks: function () {
        if (!this._pathsLayer)
            return;

        this._pathsLayer.eachLayer(function (path) {
            path.polylineHandles.enable();
        }, this);

        this._map.almostOver.enable();
    },

    removeHooks: function () {
        if (!this._pathsLayer)
            return;

        this._pathsLayer.eachLayer(function (path) {
            path.polylineHandles.disable();
        });
    },

    setPathsLayer: function (pathsLayer) {
        this._pathsLayer = pathsLayer;
        this._pathsLayer.on('data:loaded', this._onPathLoaded, this);
    },

    _onPathLoaded: function () {
        this._map.almostOver.addLayer(this._pathsLayer);

        this._pathsLayer.eachLayer(function (path) {
            path.polylineHandles.addGuideLayer(this._pathsLayer);
        }, this);

        this.fire('ready');
    },

    _onAttached: function (e) {
        var marker = e.marker,
            latlng = marker.getLatLng();

        marker.attached = e.layer;
        marker.on('detach', this._onDetached, this);

        if (!this._start) {
            this._start = marker;
        }
        else if (!this._end) {
            this._end = marker;
            this._computeRoute();
        }
        else {
            // Via
        }
    },

    _onDetached: function (e) {
        if (this._result) {
            this._map.removeLayer(this._result);
            this._result = null;
        }
        if (this._end) {
            this._end = null;
        }
        if (this._start) {
            this._start = null;
        }
    },

    _computeRoute: function () {
        var layer = this._start.attached,
            startPos = locate.call(this, layer, this._start.getLatLng()),
            endPos =  locate.call(this, layer, this._end.getLatLng());

        var subcoords = L.GeometryUtil.extract(this._map, layer, startPos, endPos);
        this._result = L.polyline(subcoords, {color: 'red', opacity: 0.3});
        this._map.addLayer(this._result);

        function locate(layer, latlng) {
            return L.GeometryUtil.locateOnLine(this._map, layer, latlng);
        }
    }
});
