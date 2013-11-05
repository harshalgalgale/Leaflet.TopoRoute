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
        this._idToLayer = null;
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

    setPathsLayer: function (pathsLayer, idToLayer) {
        this._idToLayer = idToLayer;
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
        var map = this._map,
            data = {
            start: _data(this._start),
            end: _data(this._end),
            vias: []
        };
        for (var i=0, n=this._vias.length; i<n; i++) {
            data.vias.push(_data(this._vias[i]));
        }
        this.fire('toporoute:compute', data);

        function _data(marker) {
            var pos = L.GeometryUtil.locateOnLine(map,
                                                  marker.attached,
                                                  marker.getLatLng());
            return {id: marker.attached.feature.id,
                    position: pos};
        }
    },

    _getRoute: function (shortest) {
        return L.Util.TopoRoute.toGeometry(shortest,
                                           this._map,
                                           this._idToLayer);
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
            for (var i=0; i<result.length; i++) {
                var route = this._getRoute(result[i]);
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
        this._idToLayer = null;
        this._virtual = {};
        this._nodeMaxId = -1;
    },

    setGraph: function (data, idToLayer) {
        this._data = data;
        this._idToLayer = idToLayer;

        var input = {};
        for (var node in data.nodes) {
            input[node] = {};
            var dests = data.nodes[node];
            for (var dest in dests) {
                var edgeid = data.nodes[node][dest],
                    edge = data.edges[edgeid];
                input[node][dest] = edge.length;

                if (dest > this._nodeMaxId)
                    this._nodeMaxId = dest;
            }

            if (node > this._nodeMaxId)
                this._nodeMaxId = node;
        }
        this._graph = new Graph(input);
    },

    compute: function (start, end, vias) {
        var result = [];
        vias = vias || [];
        if (vias.length === 0) {
            var shortest = this._shortestPath(start, end);
            result.push(shortest);
        }
        else {
            var shortest = this._shortestPath(start, vias[0]);
            result.push(shortest);
            for (var i=0, n=vias.length-1; i<n; i++) {
                shortest = this._shortestPath(vias[i], vias[i++]);
                result.push(shortest);
            }
            shortest = this._shortestPath(vias[vias.length-1], end);
            result.push(shortest);
        }

        if (result.indexOf(null) > -1)
            result = null;

        this.fire('computed', {result: result});
        return result;
    },

    _shortestPath: function (start, end) {
        var startnode = this._getNode(start),
            endnode = this._getNode(end),
            nodes = this._graph.findShortestPath(startnode, endnode);

        if (!nodes || nodes.length === 0) {
            console.warn('No way found between ', JSON.stringify(start), startnode, JSON.stringify(end), endnode);
            return null;
        }

        var edges = [];
        for (var i=0; i<nodes.length-1; i++) {
            edges.push(this._getEdge(nodes[i], nodes[i+1]));
        }

        // Clean-up
        for (var s in this._virtual) {
            var d = this._virtual[s];
            delete this._graph.map[s][d];
            delete this._data.nodes[s][d];
        }
        this._virtual = {};

        return L.Util.TopoRoute.shortestPath(start, end, edges, this._idToLayer);
    },

    _getEdge: function (a, b) {
        var edgeid = this._data.nodes[a][b];
        return edgeid;
    },

    _getNodes: function (edge) {
        for (var node in this._data.nodes) {
            for (var dest in this._data.nodes[node]) {
                var edgeid = this._data.nodes[node][dest];
                if (edge == edgeid) {
                    return [node, dest];
                }
            }
        }
        throw new Error("Unknown edge " + edge);
    },

    _getNode: function (input) {
        var edgeid = input.id,
            nodes = this._getNodes(edgeid),
            source = nodes[0],
            dest = nodes[1],
            cost = this._getEdge(source, dest);

        if (input.position === 0)
            return source;
        if (input.position === 1)
            return dest;

        // Create intermediary node
        // because input.position > 0 && input.position < 1
        var newnode = ++this._nodeMaxId;
        this._graph.map[source][newnode] = input.position * cost;
        this._graph.map[newnode] = {};
        this._graph.map[newnode][dest] = (1-input.position) * cost;
        this._data.nodes[source][newnode] = edgeid;
        this._data.nodes[newnode] = {};
        this._data.nodes[newnode][dest] = edgeid;
        // Keep-track, for clean-up
        this._virtual[source] = newnode;
        this._virtual[newnode] = dest;
        return newnode;
    }
});


L.Util.TopoRoute = {};

L.Util.TopoRoute.shortestPath = function (start, end, edges, idToLayer) {
    var polylines = [];
    for (var i=0, n=edges.length; i<n; i++) {
        polylines.push(idToLayer(edges[i]));
    }

    var single_path = edges.length === 1,
        startPos = start.position,
        endPos = end.position,
        polyline_start = polylines[0],
        polyline_end = polylines[polylines.length-1];

    var positions = {};

    if (single_path) {
        var lls = polyline_start.getLatLngs();

        single_path_loop = lls[0].equals(lls[lls.length-1]);

        if (single_path_loop && Math.abs(endPos - startPos) > 0.5) {
            /*
             *        A
             *     //=|---+
             *   +//      |   It is shorter to go through
             *    \\      |   extremeties than the whole loop
             *     \\=|---+
             *        B
             */
            var edgeid = edges[0];
            if (endPos - startPos > 0.5) {
                edges = [edgeid, edgeid];
                positions[0] = [startPos, 0.0];
                positions[1] = [1.0, endPos];
            }
            else if (endPos - startPos < -0.5) {
                edges = [edgeid, edgeid];
                positions[0] = [endPos, 0.0];
                positions[1] = [1.0, startPos];
            }
        }
        else {
            /*        A     B
             *   +----|=====|---->
             *
             *        B     A
             *   +----|=====|---->
             */
            positions[0] = [startPos, endPos];
        }
    }
    else {
        /*
         * Add first portion of line
         */
        var start_lls = polyline_start.getLatLngs(),
            first_end = start_lls[start_lls.length-1],
            start_on_loop = start_lls[0].equals(first_end);

        if (L.GeometryUtil.startsAtExtremity(polyline_start, polylines[1])) {
            var next_lls = polylines[1].getLatLngs(),
                next_end = next_lls[next_lls.length-1],
                share_end = first_end.equals(next_end);
            if ((start_on_loop && startPos > 0.5) ||
                (share_end && startPos > 0.5 && endPos > 0.5)) {
                /*
                 *       A
                 *    /--|===+    B
                 *  +/       \\+==|---
                 *   \       /
                 *    \-----+
                 *
                 *        A               B
                 *   +----|------><-------|----
                 *
                 *   +----|=====|><=======|----
                 *
                 */
                positions[0] = [startPos, 1.0];
            }
            else {
                /*
                 *        A               B
                 *   <----|------++-------|----
                 *
                 *   <----|=====|++=======|----
                 *
                 */
                positions[0] = [startPos, 0.0];
            }
        } else {
            /*
             *        A               B
             *   +----|------>+-------|----
             *
             *   +----|=====|>+=======|----
             *
             */
            positions[0] = [startPos, 1.0];
        }

        /*
         * Add all intermediary lines
         */
        for (var i=1; i<polylines.length-1; i++) {
            var previous = polylines[i-1],
                polyline = polylines[i];
            if (L.GeometryUtil.startsAtExtremity(polyline, previous)) {
                positions[i] = [0.0, 1.0];
            }
            else {
                positions[i] = [1.0, 0.0];
            }
        }

        /*
         * Add last portion of line
         */
        var end_lls = polyline_end.getLatLngs(),
            last_end = end_lls[end_lls.length-1],
            end_on_loop = end_lls[0].equals(last_end);

        if (L.GeometryUtil.startsAtExtremity(polyline_end, polylines[polylines.length - 2])) {
            var previous_lls = polylines[polylines.length - 2].getLatLngs(),
                previous_end = previous_lls[previous_lls.length-1],
                share_end = last_end.equals(previous_end);
            if ((end_on_loop && endPos > 0.5) ||
                (share_end && startPos > 0.5 && endPos > 0.5)) {
                /*
                 *              B
                 *     A    //==|-+
                 *  ---|==+//     |
                 *         \      |
                 *          \-----+
                 *
                 *        A               B
                 *   -----|------><-------|----+
                 *
                 *   -----|======>|+======>---->
                 */
                positions[polylines.length - 1] = [1.0, endPos];
            }
            else {
                /*
                 *        A               B
                 *   -----|------++-------|---->
                 *
                 *   -----|======+|=======>---->
                 */
                positions[polylines.length - 1] = [0.0, endPos];
            }
        } else {
            /*
             *        A               B
             *   -----|------+<-------|----+
             *
             *   -----|=====|+<=======|----+
             */
            positions[polylines.length - 1] = [1.0, endPos];
        }
    }

    return {
        positions: positions,
        paths: edges
    };
};

L.Util.TopoRoute.toGeometry = function (shortest, map, idToLayer) {
    var latlngs = [];
    for (var i=0; i<shortest.paths.length; i++) {
        var polyline = idToLayer(shortest.paths[i]),
            pos = shortest.positions ?
                  shortest.positions[i] || [0, 1] : [0, 1];

        var subline = L.GeometryUtil.extract(map, polyline, pos[0], pos[1]);
        latlngs = latlngs.concat(subline);
    }
    console.assert(latlngs.length > 2);
    return L.polyline(latlngs);
};
