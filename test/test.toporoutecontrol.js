var assert = chai.assert;

describe('L.Mixin.ActivableControl', function() {

    var Control = L.Control.Zoom.extend({
        includes: L.Mixin.ActivableControl,
    });

    describe('Activable state', function() {

        it('should be deactivated by default', function(done) {
            var control = new Control();
            assert.isFalse(!!control._activable);
            done();
        });

        it('should become activable', function(done) {
            var control = new Control();
            control.activable(true);
            assert.isTrue(control._activable);
            control.activable(false);
            assert.isFalse(control._activable);
            done();
        });

        it('should not enable handler if not activable', function(done) {
            var control = new Control();
            control.handler = new L.Handler();
            assert.isFalse(control.handler.enabled());
            control.activate();
            assert.isFalse(control.handler.enabled());
            done();
        });

        it('should enable handler if activable', function(done) {
            var map = L.map('map');
            var control = (new Control()).addTo(map);
            control.handler = new L.Map.Drag(map);
            control.activable(true);
            assert.isFalse(control.handler.enabled());
            control.activate();
            assert.isTrue(control.handler.enabled());
            map.remove();
            done();
        });
    });

});


describe('L.Control.TopoRouteControl', function() {

    var map;

    beforeEach(function() {
        map = L.map('map').fitWorld();
    });

    afterEach(function() {
        map.remove();
    });


    describe('Initalization', function() {

        it('should be deactivated by default', function(done) {
            var control = new L.Control.TopoRouteControl();
            assert.isFalse(!!control._activable);
            done();
        });

        it('should fail if map has no almostOver handler', function(done) {
            var control = new L.Control.TopoRouteControl();
            assert.throws(function () {control.addTo(map);}, 'Leaflet.AlmostOver required.');
            done();
        });

    });


    describe('Activation', function() {

        var control = new L.Control.TopoRouteControl();

        beforeEach(function() {
            map.almostOver = 1;
            control.addTo(map);
            control.handler.fire('ready');
        });

        it('should become activable one handler is ready', function(done) {
            assert.isTrue(control._activable);
            done();
        });

        it('should enable handler on click', function(done) {
            assert.isFalse(control.handler.enabled());
            var button = control._container.getElementsByTagName('a')[0];
            clickElement(button);
            assert.isTrue(control.handler.enabled());
            done();

            function clickElement(el) {
                var e = document.createEvent('MouseEvents');
                e.initMouseEvent('click', true, true, window,
                        0, 0, 0, 0, 0, false, false, false, false, 0, null);
                return el.dispatchEvent(e);
            }
        });
    });

});
