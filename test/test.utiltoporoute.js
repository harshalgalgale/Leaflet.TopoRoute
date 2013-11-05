describe('L.Util.TopoRoute', function() {

    describe('toGeometry()', function() {

        var map;

        before(function() {
            map = L.map('map').fitWorld();
        });

        after(function() {
            map.remove();
        });


        var idToLayer = function (id) {
            return {
                '1': L.polyline([[0, 0], [0, 10]]),
                '2': L.polyline([[0, 10], [20, 20]]),
                '3': L.polyline([[20, 20], [30, 20]])
            }[id];
        };

        it('should return whole polylines if no position', function(done) {
            var input = {
                paths: [1, 2],
            };
            var line = L.Util.TopoRoute.toGeometry(input, map, idToLayer);
            assert.deepEqual(line.getLatLngs(),
                             [L.latLng([0, 0]), L.latLng([0, 10]),
                              L.latLng([0, 10]), L.latLng([20, 20])]);
            done();
        });

        it('should return inverted polylines', function(done) {
            var input = {
                paths: [2, 1],
                positions: {'0': [1, 0], '1': [1, 0]}
            };
            var line = L.Util.TopoRoute.toGeometry(input, map, idToLayer);
            assert.deepEqual(line.getLatLngs(),
                             [L.latLng([20, 20]), L.latLng([0, 10]),
                              L.latLng([0, 10]), L.latLng([0, 0])]);
            done();
        });

        it('should extract polylines', function(done) {
            var input = {
                paths: [1, 2, 3],
                positions: {'0': [0.5, 1], '2': [0, 0.5]}
            };
            var line = L.Util.TopoRoute.toGeometry(input, map, idToLayer);
            assert.deepEqual(line.getLatLngs(),
                             [L.latLng([0, 4.999999999999982]), L.latLng([0, 10]),
                              L.latLng([0, 10]), L.latLng([20, 20]), L.latLng([20, 20]),
                              L.latLng([25.10209883282536, 20.00000000000001])]);
            done();
        });
    });


    describe('shortestPath()', function() {

        /*
               20.0     ^
                      3 |
                        |
               10.0     ^<---------+
                        |          |
                      2 |          | 1
                        |          |
                        |          |
                0.0     +----------+
                        |
                      4 |     5
              -10.0     v<---------+
                                  10.0
        */

        var map,
            layer,
            byid = {},
            idToLayer = function (pk) { return byid[pk]; };

        before(function() {
            map = L.map('map').fitWorld();

            layer = new L.geoJson({
                type: "FeatureCollection",
                features: [
                    {type: "Feature",
                     geometry: {type: "LineString", coordinates: [[0,0], [10,0], [10,10], [0,10]]},
                     id: 1},
                    {type: "Feature",
                     geometry: {type: "LineString", coordinates: [[0,0], [0,10]]},
                     id: 2},
                    {type: "Feature",
                     geometry: {type: "LineString", coordinates: [[0,10], [0,20]]},
                     id: 3},
                    {type: "Feature",
                     geometry: {type: "LineString", coordinates: [[0,0], [0,-10]]},
                     id: 4},
                    {type: "Feature",
                     geometry: {type: "LineString", coordinates: [[10,-10], [0,-10]]},
                     id: 5}
                ]
            }, {
                onEachFeature: function (feature, layer) {
                    byid[feature.id] = layer;
                },
            }).addTo(map);
        });

        after(function() {
            map.remove();
        });

        it('should work if start and end are on same path', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 1, position: 0.15},
                                                     {id: 1, position: 0.33},
                                                     [1],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.15, 0.33]
                },
                paths: [1]
            });
            done();
        });

        it('should work if start and end are on continous paths', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 2, position: 0.5},
                                                     {id: 3, position: 0.5},
                                                     [2, 3],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.5, 1],
                    "1": [0, 0.5]
                },
                paths: [2,3]
            });
            done();
        });

        it('should work if paths have opposite ways', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 1, position: 0.2},
                                                     {id: 2, position: 0.5},
                                                     [1, 2],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.2, 0],
                    "1": [0, 0.5]
                },
                paths: [1, 2]
            });
            done();
        });

        it('should go through extremities, even if paths have opposite ways', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 1, position: 0.9},
                                                     {id: 2, position: 0.7},
                                                     [1, 2],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.9, 1.0],
                    "1": [1.0, 0.7]
                },
                paths: [1, 2]
            });
            done();
        });

        it('should go through extremities only if it is the shortest way', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 1, position: 0.9},
                                                     {id: 2, position: 0.2},
                                                     [1, 2],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.9, 0.0],
                    "1": [0.0, 0.2]
                },
                paths: [1, 2]
            });
            done();
        });

        it('should work if middle paths have opposite ways', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 4, position: 0.5},
                                                     {id: 3, position: 0.5},
                                                     [4, 2, 3],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.5, 0],
                    "1": [0, 1],
                    "2": [0, 0.5]
                },
                paths: [4, 2, 3]
            });
            done();
        });

        it('should not cover start completely even if paths have opposite ways', function(done) {
            var topo = L.Util.TopoRoute.shortestPath({id: 4, position: 0.1},
                                                     {id: 5, position: 0.25},
                                                     [4, 5],
                                                     idToLayer);
            assert.deepEqual(topo, {
                positions: {
                    "0": [0.1, 1],
                    "1": [1, 0.25],
                },
                paths: [4, 5]
            });
            done();
        });
    });

});
