var KeyDomains = require("./KeyDomains");

function makeDomain(element, lock) {
  var domain = {
    element: element
  };

  var firstFocus = element.getAttribute("data-keydomain-focus");
  if (typeof firstFocus === "string" && firstFocus) {
    domain.focus = firstFocus;

    var focusLock = element.getAttribute("data-keydomain-focus-lock");
    if (focusLock === "true") {
      domain.focusLock = true;
    }
  }
  return domain;
}

function toArray(arrayLike) {
  return Array.prototype.slice.call(arrayLike);
}

function KeyHandler(targetElement) {
  var that = this;

  this.attached = false;
  this.mousetrap = null;
  this.mousetrapDomains = null;
  this.targetElement = targetElement;
  this._isBrowser = typeof window !== "undefined";
  this._lastFocused = null;

  var currentDomain = null;
  var allDomains = {};
  var globalCallbacks = {};
  var defaultDomain = null;

  var Mousetrap = require("mousetrap");

  that._prepare = function() {
    if (this._isBrowser && this.targetElement === document) {
      if (KeyHandler._wasDocumentRegistered) {
        throw new Error("cannot bind multiple key handler to document");
      } else {
        KeyHandler._wasDocumentRegistered = true;
      }
    }

    this.attached = true;
    this.mousetrap = new Mousetrap(targetElement);
    this.mousetrapDomains = new KeyDomains(this);

    var elements = toArray(
      this.targetElement.querySelectorAll("[data-keydomain]")
    );
    elements.forEach(function(element) {
      var keyDomain = element.getAttribute("data-keydomain");
      this.addDomain(keyDomain, element);
    }, this);
  };

  that._maybeTriggerGlobalKey = function(key, event) {
    if (globalCallbacks[key]) {
      globalCallbacks[key](event, key);
    }
  };

  that.getDomain = function(domain) {
    return allDomains[domain];
  };

  that.listDomains = function() {
    return Object.keys(allDomains);
  };

  that.getCurrentDomain = function() {
    return currentDomain;
  };

  that.getCurrentDomainElement = function() {
    if (currentDomain) {
      return allDomains[currentDomain];
    } else {
      return null;
    }
  };

  that.addDomain = function(domain, element) {
    if (!element) {
      throw new Error("Missing element when adding domain.");
    }

    if (allDomains[domain]) {
      throw new Error(`Cannot add already existing domain ${domain}`);
    }

    var domainObject = makeDomain(element, null, null);
    allDomains[domain] = domainObject;

    this.mousetrapDomains.resumeDomain(domain);

    if (currentDomain === domain) {
      this.focusDomain(domainObject);
    }
  };

  that.removeDomain = function(domain) {
    if (allDomains[domain]) {
      if (currentDomain === domain) {
        that.focusDomain(defaultDomain);
      }

      this.mousetrapDomains.suspendDomain(domain);

      delete allDomains[domain];
    }
  };

  that.setDefaultDomain = function(domainName) {
    defaultDomain = domainName;
    that.focusDomain(domainName);
  };

  that.isLockingFocus = function(domainName) {
    return !!(allDomains[domainName] && allDomains[domainName].focusLock);
  };

  that.focusDomain = function(domainName, noDomFocus) {
    if (domainName === "---") {
      return;
    }
    var domain = allDomains[domainName];
    if (!domain) {
      domainName = defaultDomain;
      domain = domainName ? allDomains[domainName] : null;
    }
    var element;
    if (this._lastFocused) {
      if (this._lastFocused !== document.body) {
        // IE10 - If body gets the focus.
        this._lastFocused.blur();
      }
      this._lastFocused = null;
    }
    currentDomain = domainName;
    if (domain) {
      if (
        typeof domain.focus === "string" &&
        (domain.focusLock || !noDomFocus)
      ) {
        element = domain.element;
        if (domain.focus.length > 0) {
          element = element.querySelector(domain.focus);
        }
        if (element) {
          if (element.setActive) {
            try {
              element.setActive(); // IE - set the element as a active and prevent from scrolling list to the top
            } catch (e) {}
          } else {
            element.focus();
          }
          this._lastFocused = element;
        }
      } else if (!noDomFocus) {
        if (domain.element.setActive) {
          try {
            domain.element.setActive();
          } catch (e) {}
        } else {
          domain.element.focus();
        }
      }
    }

    this.mousetrapDomains.focusDomain(currentDomain);
  };

  that.findDomainContaining = function(element) {
    if (element.hasAttribute("data-keydomain")) {
      return element.getAttribute("data-keydomain");
    } else if (element === document.body || !element.parentElement) {
      return null;
    } else {
      return that.findDomainContaining(element.parentElement);
    }
  };

  var keybinds = {};
  var lastId = 0;

  that.register = function(domains, keys, handlerFunction) {
    if (arguments.length === 2) {
      handlerFunction = keys;
      keys = domains;
      domains = null;
    }
    var id = lastId;
    lastId += 1;

    if (typeof keys === "string") keys = [keys];

    keybinds[id] = {
      keys: keys,
      domains: domains
    };

    if (domains) {
      this.mousetrapDomains.bindDomain(domains, keys, handlerFunction);
    } else {
      keys.forEach(function(key) {
        globalCallbacks[key] = handlerFunction;
      });
      this.mousetrap.bind(keys, handlerFunction);
    }

    return id;
  };

  that.unregister = function(handlerId) {
    // Remove the handler with the given ID.
    var identity = keybinds[handlerId];
    if (identity.domains) {
      this.mousetrapDomains.unbindDomain(identity.domains, identity.keys);
    } else {
      this.mousetrap.unbind(identity.keys);

      identity.keys.forEach(function(key) {
        delete globalCallbacks[key];
      });
    }
  };

  that.trigger = function(combo) {
    this.mousetrap.trigger(combo);
  };

  that._prepare();

  // Focus handling:
  var handlingMousedown = false;
  var focusWasReset = false;

  function mousedownHandler(event) {
    // Note: Handler is capture phase.
    handlingMousedown = true;
    var targetDomain = that.findDomainContaining(event.target);
    var focusIsInDomain =
      !!document.activeElement &&
      targetDomain === that.findDomainContaining(document.activeElement);
    setTimeout(function() {
      if (
        that.isLockingFocus(targetDomain) ||
        (!focusWasReset && !focusIsInDomain)
      ) {
        that.focusDomain(targetDomain);
      }
      focusWasReset = false;
      handlingMousedown = false;
    }, 0);
  }

  var listenerTarget;
  if (this._isBrowser && this.targetElement === document) {
    listenerTarget = document.body;
  } else {
    listenerTarget = this.targetElement;
  }

  listenerTarget.addEventListener("mousedown", mousedownHandler, true);

  function focusHandler(event) {
    // Note: Handler is capture phase.
    if (
      event.target === document.body &&
      !document.body.hasAttribute("data-keydomain")
    ) {
      // This happens when IE blurs an element - it then focuses the body. For some reason.
      return;
    }
    if (handlingMousedown) {
      focusWasReset = true;
    }
    var targetDomain = that.findDomainContaining(event.target);
    if (targetDomain !== currentDomain) {
      that.focusDomain(targetDomain, true);
      this._lastFocused = event.target;
    }
  }

  listenerTarget.addEventListener("focus", focusHandler, true);

  that.removeListeners = function() {
    listenerTarget.removeEventListener("mousedown", mousedownHandler, true);
    listenerTarget.removeEventListener("focus", focusHandler, true);
  };
}

KeyHandler.prototype.reset = function(skipPrepare) {
  this.removeListeners();

  this.mousetrapDomains.reset();
  this.mousetrap.reset();

  if (this._isBrowser && this.targetElement === document) {
    KeyHandler._wasDocumentRegistered = false;
  }

  if (typeof skipPrepare === "boolean" && skipPrepare) {
    return;
  }

  this._prepare();
};

KeyHandler._wasDocumentRegistered = false;

module.exports = KeyHandler;
