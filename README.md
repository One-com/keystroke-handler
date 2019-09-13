# KeystrokeHandler

This module provides support for binding keys to named areas
within applications.

[![NPM version](https://badge.fury.io/js/keystroke-handler.svg)](http://badge.fury.io/js/keystroke-handler)
[![Build Status](https://travis-ci.org/One-com/keystroke-handler.svg?branch=master)](https://travis-ci.org/One-com/keystroke-handler)

This module is a small wrapper around
[mousetrap](https://github.com/ccampbell/mousetrap)
library that handles the named areas and corresponding keys.

# Use

A key handler is created by instantiating it passing a
top-level target element to whcih it will bind events:

```js
var KeystrokeHandler = require("keystroke-handler");

var keyHandler = new KeystrokeHandler(document);
```

From that point forward it is available to have keys
added to it. The key defnitions are identical to those
supported by mousetrap - see: https://craig.is/killing/mice#keys.

## Global Keys

Keys can be registered for the the target element and all
its children as follows:

```js
keyHandler.register("h", function() {
  // ... call a function to show help
});
```

## Domain keys

Keys can be added to `domains` to scope keys to a particular
area within an application.

There can be registered on the fly:

```js
keyHandler.register("navigation", "1", function() {
  // ... open the first link in the navigation
});
```

The zone is now ready to be activated, and this can be done
programitically by the `focusDomain()` method (see below).

# API

- register([name], key, handler)

Add a paricular key binding.

If the name value is specified this is used as a shorthand
form for the creation of a domain and the key is added to it.

- focusDomain(name)

Make a particular domain and its associated keys active.

- addDomain(name)

Create a domain for the addition of keys.

- removeDomain(name)

Destroy a domain and all its associated key bindings.

# License

KeystrokeHandler is licensed under a standard 3-clause BSD license -- see
the `LICENSE`-file for details.
