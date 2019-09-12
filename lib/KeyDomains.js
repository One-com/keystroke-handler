/*
Portions of this file were heavily derived from earlier work by
Gert Sønderby <gert.sonderby@gmail.com> taken from the repository:
https://github.com/gertsonderby/mousetrap-domain

The code is put under a BSD 3 Clause licence with permission of the
author who retains copyright on their pparts of the code exlucing
the changes made to it.
 */

function KeyDomains(keyhandler) {
  this.keyhandler = keyhandler;
  this.mousetrap = keyhandler.mousetrap;

  this._currentDomain = null;
  this._domainCallbacks = {};
  this._suspendedCallbacks = {};
}

KeyDomains.prototype.reset = function() {
  this._currentDomain = null;
  this._domainCallbacks = {};
  this._suspendedCallbacks = {};
};

KeyDomains.prototype.focusDomain = function(name) {
  this._currentDomain = name;
};

KeyDomains.prototype._domainKeyHandler = function(key) {
  var that = this;

  return function(event, combo) {
    if (!that._currentDomain) {
      // FIXME: this is somewhat of a kludge.. when a domain
      // handler is added it overwrites the key in mousetrap
      // with a domain specific handler. In the absence of a
      // current domain we inform the parent in case there is
      // a global handler that should be executed.
      that.keyhandler._maybeTriggerGlobalKey(key, event);
    } else if (
      that._domainCallbacks[that._currentDomain] &&
      that._domainCallbacks[that._currentDomain][key]
    ) {
      // there was a handler for a domain key
      return that._domainCallbacks[that._currentDomain][key](event, combo);
    }
  };
};

KeyDomains.prototype._keyUnused = function(key) {
  return Object.keys(this._domainCallbacks).every(function(domain) {
    return !this._domainCallbacks[domain][key];
  }, this);
};

KeyDomains.prototype.bindDomain = function(domains, keys, handlerFunc) {
  if (typeof domains === "string") {
    domains = [domains];
  }
  if (typeof keys === "string") {
    keys = [keys];
  }

  keys.forEach(function(key) {
    if (this._keyUnused(key)) {
      this.mousetrap.bind(key, this._domainKeyHandler(key));
    }
  }, this);

  domains.forEach(function(domain) {
    if (!this._domainCallbacks[domain]) {
      this._domainCallbacks[domain] = {};
    }
    keys.forEach(function(key) {
      this._domainCallbacks[domain][key] = handlerFunc;
    }, this);
  }, this);
};

KeyDomains.prototype.resumeDomain = function(domains) {
  if (typeof domains === "string") {
    domains = [domains];
  }

  return domains.forEach(function(domain) {
    if (!this._suspendedCallbacks[domain]) {
      return;
    }

    var handlerByKeys = this._suspendedCallbacks[domain];
    delete this._suspendedCallbacks[domain];

    Object.keys(handlerByKeys).forEach(function(key) {
      this.bindDomain(domain, key, handlerByKeys[key]);
    }, this);
  }, this);
};

KeyDomains.prototype.suspendDomain = function(domains) {
  if (typeof domains === "string") {
    domains = [domains];
  }

  return domains.forEach(function(domain) {
    if (!this._domainCallbacks[domain]) {
      return;
    }

    var handlersByKeys = Object.assign({}, this._domainCallbacks[domain]);
    this.unbindDomain(domain, Object.keys(handlersByKeys));

    this._suspendedCallbacks[domain] = handlersByKeys;
  }, this);
};

KeyDomains.prototype.unbindDomain = function(domains, keys) {
  if (typeof domains === "string") {
    domains = [domains];
  }
  if (typeof keys === "string") {
    keys = [keys];
  }

  domains.forEach(function(domain) {
    keys.forEach(function(key) {
      delete this._domainCallbacks[domain][key];
    }, this);

    if (Object.keys(this._domainCallbacks[domain]).length === 0) {
      delete this._domainCallbacks[domain];
    }
  }, this);

  keys.forEach(function(key) {
    if (this._keyUnused(key)) {
      this.mousetrap.unbind(key);
    }
  }, this);
};

module.exports = KeyDomains;
