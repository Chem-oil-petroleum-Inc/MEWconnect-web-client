'use strict'

import CryptoUtils from '@utils/crypto-utils'
import WebsocketConnection from '@utils/websocket-connection'
import WebRTCConnection from '@utils/webrtc-connection'
import { stunServers, websocketURL } from '@config'
import { signals, rtcSignals, roles } from '@signals'

export default class Receiver {
  constructor(options = {}) {
    this.options = options

    this.socket = new WebsocketConnection()
    this.peer = new WebRTCConnection()

    this.publicKey
    this.privateKey
    this.signed
    this.connId
  }

  /*
  ===================================================================================
    Keys
  ===================================================================================
  */

  /**
   * Set the public and private keys, connId, and signed that will be used
   * for the duration of the pairing process. The receiver must receiver this information
   * from the initiator who creates the credentials initially.
   *
   * @param {String} publicKey - Public key generated by the initiator for
   *                             secure communication during the pairing process.
   * @param {String} privateKey - Private key generated by the initiator for
   *                              secure communication during the pairing process.
   * @param {String} connId - condId generated by the initiator for secure communication
   *                          during the pairing process.
   */
  async setKeys(publicKey, privateKey, connId) {
    this.publicKey = publicKey
    this.privateKey = privateKey
    this.connId = connId
    this.signed = CryptoUtils.signMessage(this.privateKey, this.privateKey)
  }

  /*
  ===================================================================================
    Encryption
  ===================================================================================
  */

  /**
   * Using the generated privateKey, encrypt a message.
   * The message must be a String, however, if an object is given,
   * it will become stringified for proper encryption.
   *
   * @param  {Object} message - String or Object to be encrypted
   * @return {Object} - Encrypted message
   */
  async encrypt(message) {
    console.log('Receiver encrypt'); // todo remove dev item

    message = typeof message === 'String' ? message : JSON.stringify(message)
    return await CryptoUtils.encrypt(message, this.privateKey)
  }

  /**
   * Decrypt an encrypted message using the generated privateKey.
   *
   * @param  {Object} message - Message to be decrypted.
   * @return {Object} - Decrypted message object
   */
  async decrypt(message) {
    console.log('Receiver decrypt'); // todo remove dev item

    const decryptedMessageString = await CryptoUtils.decrypt(
      message,
      this.privateKey
    )
    return JSON.parse(decryptedMessageString)
  }

  /*
  ===================================================================================
    Websocket
  ===================================================================================
  */

  /**
   * Given a @websocketURL, attempt to connect with given query param @options.
   * If no options are given, default to -what should- be the correct parameters.
   *
   * @param  {String} websocketURL - WS/WSS websocket URL
   * @param  {Object} options - (Optional) Connection query parameters
   */
  async connect(websocketURL, options = null) {
    const queryOptions = options
      ? options
      : {
          role: roles.receiver,
          connId: this.connId,
          signed: this.signed
        }
    console.log(websocketURL, queryOptions); // todo remove dev item
    await this.socket.connect(websocketURL, queryOptions)
  }

  /**
   * Bind a particular websocket signal/event to a given callback function.
   *
   * @param  {String} signal - Signal to listen to. E.g. 'onoffer'
   * @param  {Function} fn - Callback function to perform on given signal
   */
  on(signal, fn) {
    this.socket.on(signal, fn)
  }

  /**
   * Unbind listening to a particular signal that was bound in on()
   * @param  {String} signal - Signal to stop listening to. E.g. 'onoffer'
   */
  off(signal) {
    this.socket.off(signal)
  }

  /**
   * Emit a @signal event with a given @data payload.
   *
   * @param  {String} signal - Signal to emit. E.g. 'offersignal'
   * @param  {Object} data - Data/message payload to send
   */
  send(signal, data) {
    this.socket.send(signal, data)
  }

  /*
  ===================================================================================
    WebRTC
  ===================================================================================
  */

  /**
   * Attempt to create a WebRTC answer in response to the offer created by the initiator.
   * Return the encrypted answer for transmission to the initiator.
   *
   * @return {Object} - Encrypted WebRTC answer
   */
  async answer(offer) {
    const answer = await this.peer.answer(offer)
    return await this.encrypt(answer)
  }

  /**
   * Disconnect from current WebRTC connection
   */
  async disconnectRTC() {
    this.peer = new WebRTCConnection()
  }

  async sendRTC(signal, data = {}){
    const message = JSON.stringify({
      type: signal,
      data: data
    })
    const encrypted = await this.encrypt(message);
    this.peer.peer.send(JSON.stringify(encrypted));
  }

  /**
   * On a given @signal event from the WebRTC connection, perform callback function.
   *
   * @param  {String} signal - Signal to listen to. E.g. 'data'
   * @param  {Function} fn - Callback function to perform
   */
  onRTC(signal, fn) {
    this.peer.on(signal, fn)
  }
}
