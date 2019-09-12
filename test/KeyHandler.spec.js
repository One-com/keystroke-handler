const expect = require("unexpected")
  .clone()
  .use(require("unexpected-sinon"));
const KeyHandler = require("../lib/KeyHandler");

var sinon = require("sinon");

function createMouseEvent(options) {
  var event = document.createEvent("MouseEvent");
  var which = "which" in options ? options.which : 0;
  var bubble = "bubble" in options ? options.bubble : true;
  var cancelable = "cancelable" in options ? options.cancelable : true;
  event.initMouseEvent(
    // See https://developer.mozilla.org/en-US/docs/Web/API/event.initMouseEvent
    options.type, // type
    bubble, // can bubble
    cancelable, // can cancelable
    window,
    null,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    which, // Button: 0 = Left click, 1 = Middle click, 2 = Right click
    null
  );
  return event;
}

function mouseDown(testElement, selector) {
  var element = testElement.querySelector(selector);
  if (!element) {
    throw new Error("unable to find element");
  }
  element.dispatchEvent(createMouseEvent({ type: "mousedown" }));
}

function focus(testElement, selector) {
  var element = testElement.querySelector(selector);
  if (!element) {
    throw new Error("unable to find element");
  }
  element.focus();
}

describe("key-handler", function() {
  describe("Setup/teardown", function() {
    var keyhandler;

    beforeEach(function() {
      keyhandler = new KeyHandler(document);
    });

    afterEach(function() {
      keyhandler.reset(true);
      keyhandler = null;
    });

    it("creates a keyhandler", function() {
      expect(keyhandler, "to be ok");
      expect(keyhandler.listDomains(), "to be an empty array");
      expect(keyhandler.register, "to be a function");
    });

    it("only allows one keyhandler instance at a time", function() {
      expect(
        function() {
          // eslint-disable-next-line no-new
          new KeyHandler(document);
        },
        "to throw",
        "cannot bind multiple key handler to document"
      );
    });

    it("should reattach when doing a reset", function() {
      expect(keyhandler.attached, "to be true");
      keyhandler.reset();
      expect(keyhandler.attached, "to be true");
    });
  });

  describe("handles data-keydomain attributes and mouse/focus events", function() {
    var testElement;
    var keyhandler;
    var clock;

    beforeEach(function() {
      clock = sinon.useFakeTimers();
      testElement = document.createElement("DIV");
      testElement.innerHTML =
        '<div id="test">' +
        '  <div id="firstDomain" data-keydomain="first"><p></p></div>' +
        '  <div id="secondDomain" data-keydomain="second" data-keydomain-focus="input">' +
        '    <input id="secondDomainInput" type="text">' +
        "  </div>" +
        "</div>";
      keyhandler = new KeyHandler(testElement);
    });

    afterEach(function() {
      testElement.remove();
      clock.restore();
    });

    it("has domains", function() {
      expect(keyhandler.listDomains(), "to equal", ["first", "second"]);
    });

    it("cleans up domains when element removed", function() {
      keyhandler.removeDomain("second");
      clock.tick(100);
      expect(keyhandler.listDomains(), "to equal", ["first"]);
    });

    it("sets domains when clicked", function() {
      mouseDown(testElement, "#firstDomain>p");
      clock.tick(100);
      expect(keyhandler.getCurrentDomain(), "to be", "first");
      mouseDown(testElement, "#secondDomain");
      clock.tick(100);
      expect(keyhandler.getCurrentDomain(), "to be", "second");
      mouseDown(testElement, "#test");
      clock.tick(100);
      expect(keyhandler.getCurrentDomain(), "to be null");
    });

    it("sets domains when focused", function() {
      focus(testElement, "#secondDomain>input");
      clock.tick(100);
      expect(keyhandler.getCurrentDomain(), "to be", "second");
    });

    it("focuses the first-focus selector when domain selected", function() {
      keyhandler.focusDomain("second");
      expect(
        document.activeElement,
        "to be",
        testElement.querySelector("#secondDomain>input")
      );
    });
  });

  describe("registers key events", function() {
    var testElement;
    var keyhandler;
    var clock;

    beforeEach(function() {
      clock = sinon.useFakeTimers();
      testElement = document.createElement("DIV");
      testElement.innerHTML =
        '<div id="test">' +
        '  <div id="firstDomain" data-keydomain="first"><p></p></div>' +
        '  <div id="secondDomain" data-keydomain="second" data-keydomain-focus="input">' +
        '    <input id="secondDomainInput" type="text">' +
        "  </div>" +
        "</div>";
      keyhandler = new KeyHandler(testElement);
    });

    afterEach(function() {
      testElement.remove();
      clock.restore();
    });

    it("should allow registering key handlers globally", function() {
      var handler = sinon.spy();
      keyhandler.register("h", handler);

      keyhandler.trigger("h");
      expect(handler, "was called");
      handler.resetHistory();

      var handlerOther = sinon.spy();
      keyhandler.register("first", "h", handlerOther);

      keyhandler.trigger("h");
      expect(handler, "was called");
      expect(handlerOther, "was not called");
    });

    it("should trigger the key in the right domain", function() {
      var handler = sinon.spy();
      keyhandler.register("first", "h", handler);
      keyhandler.focusDomain("first");
      expect(keyhandler.getCurrentDomain(), "to be", "first");
      keyhandler.trigger("h");
      expect(handler, "was called");
    });

    it("should not confuse keys between domains", function() {
      var handler = sinon.spy();
      keyhandler.register("first", "h", handler);
      keyhandler.focusDomain("second");

      expect(keyhandler.getCurrentDomain(), "to be", "second");

      keyhandler.trigger("h");
      expect(handler, "was not called");
    });

    it("should remove the domain bindings if the key is unregistered", function() {
      var handlerFirst = sinon.spy();
      var handlerSecond = sinon.spy();
      keyhandler.register("first", "h", handlerFirst);
      var secondHandlerId = keyhandler.register("second", "h", handlerSecond);

      expect(keyhandler.mousetrapDomains._domainCallbacks, "to equal", {
        first: { h: handlerFirst },
        second: { h: handlerSecond }
      });

      keyhandler.unregister(secondHandlerId);

      expect(keyhandler.mousetrapDomains._domainCallbacks, "to equal", {
        first: { h: handlerFirst }
      });
    });

    it("should fire the correct handler when the focus changes", function() {
      var handlerFirst = sinon.spy();
      var handlerSecond = sinon.spy();
      keyhandler.register("first", "h", handlerFirst);
      keyhandler.register("second", "h", handlerSecond);

      keyhandler.focusDomain("first");

      keyhandler.trigger("h");

      expect(handlerFirst, "was called");
      expect(handlerSecond, "was not called");
    });

    it("which persist when domains are removed and reinstituted", function() {
      var handlerFirst = sinon.spy();
      var handlerSecond = sinon.spy();
      keyhandler.register("first", "h", handlerFirst);
      keyhandler.register("second", "h", handlerSecond);

      expect(keyhandler.mousetrapDomains._domainCallbacks, "to equal", {
        first: { h: handlerFirst },
        second: { h: handlerSecond }
      });
      keyhandler.removeDomain("second");

      expect(keyhandler.mousetrapDomains._domainCallbacks, "to equal", {
        first: { h: handlerFirst }
      });
      expect(keyhandler.mousetrapDomains._suspendedCallbacks, "to equal", {
        second: { h: handlerSecond }
      });

      keyhandler.addDomain(
        "second",
        testElement.querySelector("#secondDomain")
      );
      keyhandler.focusDomain("second");

      keyhandler.trigger("h");

      expect(handlerSecond, "was called");
    });
  });
});
