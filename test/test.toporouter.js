describe('L.TopoRouter', function() {

    describe('Setting graph', function() {

        var router = new L.TopoRouter();

        it('should initialize internal graph', function(done) {
            var data = {
                nodes: {'1': {'2': 100}, '2': {'1': 101}},
                edges: {'100': {length: 3.14}, '101': {length: 1.414}}
            };
            router.setGraph(data);
            assert.isNotNull(router._graph);
            assert.isNotNull(router._data);

            assert.deepEqual(router._graph.map, {'1': {'2': 3.14},
                                                 '2': {'1': 1.414}});
            done();
        });
    });


    describe('Compute shortest path', function() {

        var router;

        before(function () {
            router = new L.TopoRouter();
            var data = {
                nodes: {'1': {'2': 100},
                        '2': {'1': 100,
                              '3': 101},
                        '3': {'2': 101,
                              '4': 102},
                        '4': {'3': 102},
                        '5': {'6': 103}}, // un-connected
                edges: {'100': {length: 3.14},
                        '101': {length: 1.414},
                        '102': {length: 7},
                        '103': {length: 5}}
            };
            var idToLayer = function (id) {
                var layers = {
                    '100': L.polyline([[0, 0], [0, 10]]),
                    '101': L.polyline([[0, 10], [0, 20]]),
                    '102': L.polyline([[0, 20], [0, 30]]),
                    '103': L.polyline([[30, 30], [30, 40]])
                };
                return layers[id];
            };
            router.setGraph(data, idToLayer);
        });

        it('should return null if no path found', function(done) {
            var result = router.compute({id: 100}, {id: 103});
            assert.equal(result, null);
            result = router.compute({id: 102}, {id: 101}, [{id: 100}, {id: 103}]);
            assert.equal(result, null);
            done();
        });

        it('should result single layer if no vias', function(done) {
            var result = router.compute({id: 100, position: 0},
                                        {id: 101, position: 1});
            assert.deepEqual(result, [{positions: {'0': [0, 1],
                                                   '1': [0, 1]},
                                       paths: [100, 101]}]);
            done();
        });

        it('should work with single path', function(done) {
            var result = router.compute({id: 100, position: 0},
                                        {id: 100, position: 1});
            assert.deepEqual(result, [{positions: {'0': [0, 1]},
                                       paths: [100]}]);
            done();
        });

        it('should as many paths as vias', function(done) {
            var result = router.compute({id: 100, position: 0.1},
                                        {id: 102, position: 0.9},
                                        [{id: 101, position: 0.5}]);
            assert.deepEqual(result, [{positions: {'0': [0.1, 1],
                                                   '1': [0, 0.5]},
                                       paths: [100, 101]},
                                      {positions: {'0': [0.5, 1],
                                                   '1': [0, 0.9]},
                                       paths: [101, 102]}]);
            done();
        });

        it('should work as reverse path', function(done) {
            var result = router.compute({id: 101, position: 1},
                                        {id: 100, position: 0});
            assert.deepEqual(result, [{positions: {'0': [1, 0],
                                                   '1': [1, 0]},
                                       paths: [101, 100]}]);
            done();
        });
    });


});
