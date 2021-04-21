import eventsToRecord from '../code-generator/dom-events-to-record'
import UIController from './UIController'
import actions from '../models/extension-ui-actions'
import ctrl from '../models/extension-control-messages'
import finder from '@medv/finder'

const DEFAULT_MOUSE_CURSOR = 'default'

export default class EventRecorder {
  constructor () {
    this._boundedMessageListener = null
    this._eventLog = []
    this._previousEvent = null
    this._dataAttribute = null
    this._uiController = null
    this._screenShotMode = false
    this._isTopFrame = (window.location === window.parent.location)
    this._isRecordingClicks = true

    this.mouseOverEvent = null
    this.mouseOutEvent = null
    this.selectorHelper = null

    chrome.extension.onConnect.addListener(port => {
      console.debug('listeners connected')
      port.onMessage.addListener(msg => {
        console.log(msg)
      })
    })
  }

  boot () {
    // We need to check the existence of chrome for testing purposes
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['options'], ({options}) => {
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

  _initializeRecorder () {
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
      this._sendMessage({ control: ctrl.GET_VIEWPORT_SIZE, coordinates: { width: window.innerWidth, height: window.innerHeight } })
      console.debug('Puppeteer Recorder in-page EventRecorder started')
    }
  }

  _handleBackgroundMessage (msg, sender, sendResponse) {
    console.debug('content-script: message from background', msg)
    if (msg && msg.action) {
      console.log('ACAAA', msg)
      switch (msg.action) {
        case actions.TOGGLE_SCREENSHOT_MODE:
          this._handleScreenshotMode(false)
          break

        case actions.TOGGLE_SCREENSHOT_CLIPPED_MODE:
          this._handleScreenshotMode(true)
          break

        case actions.TOGGLE_SELECTOR_HELPER:
          msg.value ? this._attachSelectorHelper() : this._dettachSelectorHelper()
          break
      }
    }
  }

  _addAllListeners (events) {
    const boundedRecordEvent = this._recordEvent.bind(this)
    events.forEach(type => {
      window.addEventListener(type, boundedRecordEvent, true)
    })
  }

  _sendMessage (msg) {
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

  _recordEvent (e) {
    if (this._previousEvent && this._previousEvent.timeStamp === e.timeStamp) return
    this._previousEvent = e

    // we explicitly catch any errors and swallow them, as none node-type events are also ingested.
    // for these events we cannot generate selectors, which is OK
    try {
      this._sendMessage({
        selector: this._getSelector(e),
        value: e.target.value,
        tagName: e.target.tagName,
        action: e.type,
        keyCode: e.keyCode ? e.keyCode : null,
        href: e.target.href ? e.target.href : null,
        coordinates: EventRecorder._getCoordinates(e)
      })
    } catch (e) {}
  }

  _getEventLog () {
    return this._eventLog
  }

  _clearEventLog () {
    this._eventLog = []
  }

  _handleScreenshotMode (isClipped) {
    this._disableClickRecording()
    this._uiController = new UIController({ showSelector: isClipped })
    this._screenShotMode = !this._screenShotMode
    document.body.style.cursor = 'crosshair'

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

  _disableClickRecording () {
    this._isRecordingClicks = false
  }

  _enableClickRecording () {
    this._isRecordingClicks = true
  }

  _getSelector (e) {
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
  }

  _attachSelectorHelper () {
    console.debug('attach overlay')

    if (this.selectorHelper) { return }

    this.selectorHelper = document.createElement('span')
    this.selectorHelper.className = 'selector-helper'
    document.body.appendChild(this.selectorHelper)

    this.mouseOverEvent = (e) => {
      this.selectorHelper.innerText = this._getSelector(e)
      e.target.classList.add('curent-selector')
    }

    this.mouseOutEvent = (e) => {
      e.target.classList.remove('curent-selector')
    }

    window.document.addEventListener('mouseover', this.mouseOverEvent)
    window.document.addEventListener('mouseout', this.mouseOutEvent)

    // TODO: Move this to inline styles and avoid classes
    const css = `
    .curent-selector {
      background: rgba(0, 0, 0, 0.1);
    }

    .selector-helper {
      z-index: 2147483647;
      position: fixed;
      bottom: 10px;
      right: 10px;
      background-color: #000;
      border-radius: 1px;
      font-family: monospace;
      font-size: 12px;
      font-weigth: 500;
      color: #fff;
      padding: 0.1rem 0.3rem;
      transition: all 0.1s ease;
    }
    `

    const head = document.head || document.getElementsByTagName('head')[0]
    const style = document.createElement('style')

    head.appendChild(style)

    style.type = 'text/css'
    style.appendChild(document.createTextNode(css))
  }

  _dettachSelectorHelper () {
    console.debug('dettach overlay')
    document.body.removeChild(this.selectorHelper)
    this.selectorHelper = null
    window.document.removeEventListener('mouseover', this.mouseOverEvent)
    window.document.removeEventListener('mouseout', this.mouseOutEvent)
  }

  static _getCoordinates (evt) {
    const eventsWithCoordinates = {
      mouseup: true,
      mousedown: true,
      mousemove: true,
      mouseover: true
    }
    return eventsWithCoordinates[evt.type] ? { x: evt.clientX, y: evt.clientY } : null
  }
}
