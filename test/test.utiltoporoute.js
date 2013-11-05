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
});
