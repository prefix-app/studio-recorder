import eventsToRecord from '../code-generator/dom-events-to-record'
import UIController from './UIController'
import actions from '../models/extension-ui-actions'
import ctrl from '../models/extension-control-messages'
import finder from '@medv/finder'

const DEFAULT_MOUSE_CURSOR = 'default'

export default class EventRecorder {
  constructor() {
    this._boundedMessageListener = null
    this._eventLog = []
    this._previousEvent = null
    this._dataAttribute = null
    this._uiController = null
    this._screenShotMode = false
    this._isTopFrame = (window.location === window.parent.location)
    this._isRecordingClicks = true
  }

  _translateAction(e) {
    switch (e.type) {
      case "click":
        return "Click Once";
      case "keydown":
        if (e.keyCode == 13) {
          return "Hit Enter";
        }
        return "Fill Field";
      case "select":
        return "Dropdown Select";
      case "change":
        return "Dropdown Select";
      case "navigation*":
        return "Open URL";
      case "goto*":
        return "Open URL";
    }
    return e.type;
  }

  _getReadableName(el, selectedSelector) {
    if (selectedSelector == null)
      return null

    var readableName = '';

    if ('name' in el) {
      if (el.name !== '') {
        readableName = el.name;
      }
    }
    if ('defaultValue' in el) {
      if (el.defaultValue !== '') {
        readableName = el.defaultValue;
      }
    }
    if ('placeholder' in el) {
      if (el.placeholder !== '') {
        readableName = el.placeholder;
      }
    }
    if ('innerText' in el) {
      if (el.innerText !== '') {
        readableName = el.innerText;
      }
    }
    if ('alt' in el) {
      if (el.alt !== '') {
        readableName = el.alt;
      }
    }
    if ('title' in el) {
      if (el.title !== '') {
        readableName = el.title;
      }
    }

    if (readableName === '') {
      readableName = selectedSelector;
    }

    if (readableName && readableName.length > 26) {
      readableName = readableName.substring(0, 26) + '..';
    }

    readableName = readableName.replace(/(\r\n|\n|\r)/gm, "");

    if (el.tagName == 'A') {
      readableName += " [Link]"
    }
    if (el.tagName == 'INPUT') {
      if (el.type == 'BUTTON') {
        readableName += " [Button]"
      } else if (el.type == 'CHECKBOX') {
        readableName += " [Checkbox]"
      } else if (el.type == 'COLOR') {
        readableName += " [Color]"
      } else if (el.type == 'DATE') {
        readableName += " [Date]"
      } else if (el.type == 'FILE') {
        readableName += " [File]"
      } else if (el.type == 'RADIO') {
        readableName += " [Radio]"
      } else if (el.type == 'TEXT') {
        readableName += " [Text]"
      } else {
        readableName += " [Input]"
      }
    }
    if (el.tagName == 'BUTTON') {
      readableName += " [Button]"
    }
    if (el.tagName == 'IMG') {
      readableName += " [Image]"
    }
    if (['SPAN', 'P'].includes(el.tagName)) {
      readableName += " [Text]"
    }
    if (['SECTION', 'DIV'].includes(el.tagName)) {
      if (el.type == 'BUTTON') {
        readableName += " [Button]"
      } else if (el.type == 'CHECKBOX') {
        readableName += " [Checkbox]"
      } else if (el.type == 'COLOR') {
        readableName += " [Color]"
      } else if (el.type == 'DATE') {
        readableName += " [Date]"
      } else if (el.type == 'FILE') {
        readableName += " [File]"
      } else if (el.type == 'RADIO') {
        readableName += " [Radio]"
      } else if (el.type == 'TEXT') {
        readableName += " [Text]"
      } else {
        readableName += " [Section]"
      }
    }
    if (['TR', 'TD', 'TH', 'TABLE'].includes(el.tagName)) {
      readableName += " [Table]"
    }

    return readableName;
  }

  boot() {
    // We need to check the existence of chrome for testing purposes
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['options'], ({ options }) => {
        const { dataAttribute } = options ? options.code : {}
        if (dataAttribute) {
          this._dataAttribute = dataAttribute
        }
        this._initializeRecorder()
      })
    } else {
      this._initializeRecorder()
    }
  }

  _initializeRecorder() {
    const events = Object.values(eventsToRecord)
    if (!window.pptRecorderAddedControlListeners) {
      this._addAllListeners(events)
      this._boundedMessageListener = this._boundedMessageListener || this._handleBackgroundMessage.bind(this)
      chrome.runtime.onMessage.addListener(this._boundedMessageListener)
      window.pptRecorderAddedControlListeners = true
    }

    if (!window.document.pptRecorderAddedControlListeners && chrome.runtime && chrome.runtime.onMessage) {
      window.document.pptRecorderAddedControlListeners = true
    }

    if (this._isTopFrame) {
      this._sendMessage({ control: ctrl.EVENT_RECORDER_STARTED })
      this._sendMessage({ control: ctrl.GET_CURRENT_URL, href: window.location.href })
      //this._sendMessage({ control: ctrl.GET_VIEWPORT_SIZE, coordinates: { width: window.innerWidth, height: window.innerHeight } })
      console.debug('Puppeteer Recorder in-page EventRecorder started')
    }
  }

  _handleBackgroundMessage(msg, sender, sendResponse) {
    console.debug('content-script: message from background', msg)
    if (msg && msg.action) {
      switch (msg.action) {
        case actions.TOGGLE_SCREENSHOT_MODE:
          this._handleScreenshotMode(false)
          break
        case actions.TOGGLE_SCREENSHOT_CLIPPED_MODE:
          this._handleScreenshotMode(true)
          break
        default:
      }
    }
  }

  _addAllListeners(events) {
    const boundedRecordEvent = this._recordEvent.bind(this)
    events.forEach(type => {
      window.addEventListener(type, boundedRecordEvent, true)
    })
  }

  _sendMessage(msg) {
    // filter messages based on enabled / disabled features
    if (msg.action === 'click' && !this._isRecordingClicks) return

    try {
      // poor man's way of detecting whether this script was injected by an actual extension, or is loaded for
      // testing purposes
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.sendMessage(msg)
      } else {
        this._eventLog.push(msg)
      }
    } catch (err) {
      console.debug('caught error', err)
    }
  }

  _updateMessage(msg) {
    msg.update = true;
    try {
      // poor man's way of detecting whether this script was injected by an actual extension, or is loaded for
      // testing purposes
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.sendMessage(msg)
      }
    } catch (err) {
      console.debug('caught error', err)
    }
  }

  _recordEvent(e) {
    // we explicitly catch any errors and swallow them, as none node-type events are also ingested.
    // for these events we cannot generate selectors, which is OK
    try {
      const currentEvent = {
        update: false,
        selector: this._getSelector(e),
        value: e.target.value,
        readableName: this._getReadableName(e.target, this._getSelector(e)),
        tagName: e.target.tagName,
        action: this._translateAction(e),
        keyCodes: e.keyCode ? [e.keyCode] : [],
        href: e.target.href ? e.target.href : '',
        coordinates: EventRecorder._getCoordinates(e),
        timeStamp: e.timeStamp
      }

      console.log(currentEvent)

      if (currentEvent.action === 'Fill Field' &&
        currentEvent.keyCodes[0] !== 13 &&
        this._previousEvent &&
        this._previousEvent.action === 'Fill Field' &&
        this._previousEvent.selector === currentEvent.selector) {
        this._updateMessage(currentEvent)
      } else {
        if (currentEvent.action == 'Dropdown Select') {
          if (currentEvent.tagName == 'SELECT') {
            this._sendMessage(currentEvent)
            if (this._previousEvent && this._previousEvent.timeStamp === e.timeStamp) return
            this._previousEvent = currentEvent
          }
        } else {
          this._sendMessage(currentEvent)
          if (this._previousEvent && this._previousEvent.timeStamp === e.timeStamp) return
          this._previousEvent = currentEvent
        }
      }
    } catch (e) {
    }
  }

  _getEventLog() {
    return this._eventLog
  }

  _clearEventLog() {
    this._eventLog = []
  }

  _handleScreenshotMode(isClipped) {
    this._disableClickRecording()
    this._uiController = new UIController({ showSelector: isClipped })
    this._screenShotMode = !this._screenShotMode
    document.body.style.cursor = 'crosshair'

    console.debug('screenshot mode:', this._screenShotMode)
    if (this._screenShotMode) {
      this._uiController.showSelector()
    } else {
      this._uiController.hideSelector()
    }
    this._uiController.on('click', event => {
      this._screenShotMode = false
      document.body.style.cursor = DEFAULT_MOUSE_CURSOR
      this._sendMessage({ control: ctrl.GET_SCREENSHOT, value: event.clip })
      this._enableClickRecording()
    })
  }

  _disableClickRecording() {
    this._isRecordingClicks = false
  }

  _enableClickRecording() {
    this._isRecordingClicks = true
  }

  _getSelector(e) {
    try {
      if (this._dataAttribute && e.target.getAttribute(this._dataAttribute)) {
        return `[${this._dataAttribute}="${e.target.getAttribute(this._dataAttribute)}"]`
      }

      if (e.target.id) {
        return `#${e.target.id}`
      }

      return finder(e.target, {
        seedMinLength: 5,
        optimizedMinLength: (e.target.id) ? 2 : 10,
        attr: (name, _value) => name === this._dataAttribute
      })
    } catch (e) {
      return null;
    }
  }

  static _getCoordinates(evt) {
    const eventsWithCoordinates = {
      mouseup: true,
      mousedown: true,
      mousemove: true,
      mouseover: true
    }
    return eventsWithCoordinates[evt.type] ? { x: evt.clientX, y: evt.clientY } : null
  }
}
