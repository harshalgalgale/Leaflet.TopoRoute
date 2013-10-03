L.Control.TopoRouteControl = L.Control.extend({

    statics: {
        TITLE: 'Route',
        LABEL: 'o',
    },

    initialize: function (map, pathsLayer, options) {
        L.Control.prototype.initialize.call(this, options);
        this._pathsLayer = pathsLayer;

        this._result = null;
    },

    onAdd: function (map) {
        this._pathsLayer.on('data:loaded', this._onPathLoaded, this);

        if (this._map.almostOver === undefined) {
            throw 'Leaflet.AlmostOver required.'
        }
        return this._initContainer();
    },

    _initContainer: function () {
        // Create a button, and bind click on hidden file input
        var zoomName = 'leaflet-control-toporoute leaflet-control-zoom',
            barName = 'leaflet-bar',
            partName = barName + '-part',
            container = L.DomUtil.create('div', zoomName + ' ' + barName);
        var link = L.DomUtil.create('a', zoomName + '-in ' + partName, container);
        link.innerHTML = L.Control.TopoRouteControl.LABEL;
        link.href = '#';
        link.title = L.Control.TopoRouteControl.TITLE;

        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(link, 'click', stop)
            .on(link, 'mousedown', stop)
            .on(link, 'dblclick', stop)
            .on(link, 'click', L.DomEvent.preventDefault)
            .on(link, 'click', function (e) {
                
            });
        return container;
    },

    _onPathLoaded: function () {
        var oneline = this._pathsLayer.getLayers()[0];
        oneline.setStyle({color: 'green', opacity: 1.0, weigth: 4, color: 'red'});
        this._map.almostOver.addLayer(oneline);

        oneline.polylineHandles.addGuideLayer(this._pathsLayer);
        oneline.polylineHandles.enable();
        oneline.polylineHandles.on('attach', this._onAttached, this);
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
