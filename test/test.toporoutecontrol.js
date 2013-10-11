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
            done();
        });
    });

});
