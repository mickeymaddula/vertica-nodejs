// Copyright (c) 2022 Micro Focus or one of its affiliates.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'
// make assert a global...
global.assert = require('assert')
var sys = require('util')

const Suite = require('./suite')
const args = require('./cli')

global.Client = require('./../lib').Client

global.defaults = require('./../lib').defaults

process.on('uncaughtException', function (d) {
  if ('stack' in d && 'message' in d) {
    console.log('Message: ' + d.message)
    console.log(d.stack)
  } else {
    console.log(d)
  }
  process.exit(-1)
})

assert.same = function (actual, expected) {
  for (var key in expected) {
    assert.equal(actual[key], expected[key])
  }
}

assert.emits = function (item, eventName, callback, message) {
  var called = false
  var id = setTimeout(function () {
    test("Should have called '" + eventName + "' event", function () {
      assert.ok(called, message || "Expected '" + eventName + "' to be called.")
    })
  }, 5000)

  item.once(eventName, function () {
    if (eventName === 'error') {
      // belt and braces test to ensure all error events return an error
      assert.ok(
        arguments[0] instanceof Error,
        'Expected error events to throw instances of Error but found: ' + sys.inspect(arguments[0])
      )
    }
    called = true
    clearTimeout(id)
    assert.ok(true)
    if (callback) {
      callback.apply(item, arguments)
    }
  })
}

assert.UTCDate = function (actual, year, month, day, hours, min, sec, milisecond) {
  var actualYear = actual.getUTCFullYear()
  assert.equal(actualYear, year, 'expected year ' + year + ' but got ' + actualYear)

  var actualMonth = actual.getUTCMonth()
  assert.equal(actualMonth, month, 'expected month ' + month + ' but got ' + actualMonth)

  var actualDate = actual.getUTCDate()
  assert.equal(actualDate, day, 'expected day ' + day + ' but got ' + actualDate)

  var actualHours = actual.getUTCHours()
  assert.equal(actualHours, hours, 'expected hours ' + hours + ' but got ' + actualHours)

  var actualMin = actual.getUTCMinutes()
  assert.equal(actualMin, min, 'expected min ' + min + ' but got ' + actualMin)

  var actualSec = actual.getUTCSeconds()
  assert.equal(actualSec, sec, 'expected sec ' + sec + ' but got ' + actualSec)

  var actualMili = actual.getUTCMilliseconds()
  assert.equal(actualMili, milisecond, 'expected milisecond ' + milisecond + ' but got ' + actualMili)
}

assert.equalBuffers = function (actual, expected) {
  if (actual.length != expected.length) {
    spit(actual, expected)
    assert.equal(actual.length, expected.length)
  }
  for (var i = 0; i < actual.length; i++) {
    if (actual[i] != expected[i]) {
      spit(actual, expected)
    }
    assert.equal(actual[i], expected[i])
  }
}

assert.empty = function (actual) {
  assert.lengthIs(actual, 0)
}

assert.success = function (callback) {
  if (callback.length === 1 || callback.length === 0) {
    return assert.calls(function (err, arg) {
      if (err) {
        console.log(err)
      }
      assert(!err)
      callback(arg)
    })
  } else if (callback.length === 2) {
    return assert.calls(function (err, arg1, arg2) {
      if (err) {
        console.log(err)
      }
      assert(!err)
      callback(arg1, arg2)
    })
  } else {
    throw new Error('need to preserve arrity of wrapped function')
  }
}

assert.lengthIs = function (actual, expectedLength) {
  assert.equal(actual.length, expectedLength)
}

var expect = function (callback, timeout) {
  var executed = false
  timeout = timeout || parseInt(process.env.TEST_TIMEOUT) || 5000
  var id = setTimeout(function () {
    assert.ok(
      executed,
      'Expected execution of function to be fired within ' +
        timeout +
        ' milliseconds ' +
        ' (hint: export TEST_TIMEOUT=<timeout in milliseconds>' +
        ' to change timeout globally)' +
        callback.toString()
    )
  }, timeout)

  if (callback.length < 3) {
    return function (err, queryResult) {
      clearTimeout(id)
      if (err) {
        assert.ok(err instanceof Error, 'Expected errors to be instances of Error: ' + sys.inspect(err))
      }
      callback.apply(this, arguments)
    }
  } else if (callback.length == 3) {
    return function (err, arg1, arg2) {
      clearTimeout(id)
      if (err) {
        assert.ok(err instanceof Error, 'Expected errors to be instances of Error: ' + sys.inspect(err))
      }
      callback.apply(this, arguments)
    }
  } else {
    throw new Error('Unsupported arrity ' + callback.length)
  }
}
assert.calls = expect

assert.isNull = function (item, message) {
  message = message || 'expected ' + item + ' to be null'
  assert.ok(item === null, message)
}

global.test = function (name, action) {
  test.testCount++
  test[name] = action
  var result = test[name]()
  if (result === false) {
    process.stdout.write('?')
  } else {
    process.stdout.write('.')
  }
}

// print out the filename
process.stdout.write(require('path').basename(process.argv[1]))
if (args.binary) process.stdout.write(' (binary)')

process.on('exit', function () {
  console.log('')
})

process.on('uncaughtException', function (err) {
  console.error('\n %s', err.stack || err.toString())
  // causes xargs to abort right away
  process.exit(255)
})

var Sink = function (expected, timeout, callback) {
  var defaultTimeout = 5000
  if (typeof timeout === 'function') {
    callback = timeout
    timeout = defaultTimeout
  }
  timeout = timeout || defaultTimeout
  var internalCount = 0
  var kill = function () {
    assert.ok(false, 'Did not reach expected ' + expected + ' with an idle timeout of ' + timeout)
  }
  var killTimeout = setTimeout(kill, timeout)
  return {
    add: function (count) {
      count = count || 1
      internalCount += count
      clearTimeout(killTimeout)
      if (internalCount < expected) {
        killTimeout = setTimeout(kill, timeout)
      } else {
        assert.equal(internalCount, expected)
        callback()
      }
    },
  }
}

var getTimezoneOffset = Date.prototype.getTimezoneOffset

var setTimezoneOffset = function (minutesOffset) {
  Date.prototype.getTimezoneOffset = function () {
    return minutesOffset
  }
}

var resetTimezoneOffset = function () {
  Date.prototype.getTimezoneOffset = getTimezoneOffset
}

var generateSeriesStatement = function (count) {
  let text = 'SELECT 0'
  for (let i = 1; i < count; i++) {
    text += "union SELECT " + i
  }
  return text
}


const rejection = (promise) =>
  promise.then(
    (value) => {
      throw new Error(`Promise resolved when rejection was expected; value: ${sys.inspect(value)}`)
    },
    (error) => error
  )

module.exports = {
  Sink: Sink,
  Suite: Suite,
  vertica: require('./../lib/'),
  args: args,
  config: args,
  sys: sys,
  Client: Client,
  setTimezoneOffset: setTimezoneOffset,
  resetTimezoneOffset: resetTimezoneOffset,
  rejection: rejection,
  generateSeriesStatement: generateSeriesStatement
}
