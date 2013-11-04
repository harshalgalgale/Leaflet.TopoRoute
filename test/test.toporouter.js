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


    describe('Shortest path', function() {

        var router;

        before(function () {
            router = new L.TopoRouter();
            var data = {
                nodes: {'1': {'2': 100}, '2': {'1': 101}},
                edges: {'100': {length: 3.14}, '101': {length: 1.414}}
            };
            router.setGraph(data);
        });

        it('should result single layer if no vias', function(done) {
            var result = router.compute({id: 100}, {id: 101});
            assert.deepEqual(result, [{edges: [100]}]);
            var result = router.compute({id: 101}, {id: 100});
            assert.deepEqual(result, [{edges: [101]}]);
            done();
        });

        it('should as many paths as vias', function(done) {
            var result = router.compute(100, 101, [100]);
            assert.deepEqual(result, [{edges: []}, {edges: []}]);
            done();
        });
    });


});
