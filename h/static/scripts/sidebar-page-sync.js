'use strict';

var events = require('./events');
var metadata = require('./annotation-metadata');

/**
 * @typedef FrameInfo
 * @property {string} uri - Current primary URI of the document being displayed
 * @property {string[]} searchUris - List of URIs that should be passed to the
 *           search API when searching for annotations on this document.
 * @property {string} documentFingerprint - Fingerprint of the document, used
 *                    for PDFs
 */

/**
 * This service runs in the sidebar and is responsible for keeping the set of
 * annotations displayed in the page in sync with the set shown in the sidebar.
 */
// @ngInject
function sidebarPageSync($rootScope, Discovery, annotationUI, bridge) {

  // Set of tags of annotations that are currently loaded into the page
  var inPage = new Set();

  /**
   * Return a minimal representation of an annotation that can be sent from the
   * sidebar app to the page.
   *
   * Because this representation will be exposed to untrusted third-party
   * JavaScript running in the page, it includes only the information needed
   * to uniquely identify it within the current session and anchor it in the
   * page.
   */
  function formatAnnot(annot) {
    return {
      tag: annot.$$tag,
      msg: {
        document: annot.document,
        target: annot.target,
        uri: annot.uri,
      },
    };
  }

  /**
   * Watch for changes to the set of annotations displayed in the sidebar and
   * notify connected pages about new/updated/deleted annotations.
   */
  function setupSyncToPage() {
    // List of loaded annotations in previous state
    var prevAnnotations = [];

    annotationUI.subscribe(function () {
      var state = annotationUI.getState();
      if (state.annotations === prevAnnotations) {
        return;
      }

      var inSidebar = new Set();
      var added = [];

      state.annotations.forEach(function (annot) {
        if (metadata.isReply(annot)) {
          // The page does not need to know about replies
          return;
        }

        inSidebar.add(annot.$$tag);
        if (!inPage.has(annot.$$tag)) {
          added.push(annot);
        }
      });
      var deleted = prevAnnotations.filter(function (annot) {
        return !inSidebar.has(annot.$$tag);
      });
      prevAnnotations = state.annotations;

      // We currently only handle adding and removing annotations from the page
      // when they are added or removed in the sidebar, but not re-anchoring
      // annotations if their selectors are updated.
      if (added.length > 0) {
        bridge.call('loadAnnotations', added.map(formatAnnot));
        added.forEach(function (annot) {
          inPage.add(annot.$$tag);
        });
      }
      deleted.forEach(function (annot) {
        bridge.call('deleteAnnotation', formatAnnot(annot));
        inPage.remove(annot.$$tag);
      });
    });
  }

  /**
   * Listen for messages coming in from connected pages and add new annotations
   * to the sidebar.
   */
  function setupSyncFromPage() {
    // A new annotation, note or highlight was created in the page
    bridge.on('beforeCreateAnnotation', function (event) {
      inPage.add(event.tag);
      var annot = Object.assign({}, event.msg, {$$tag: event.tag});
      $rootScope.$broadcast(events.BEFORE_ANNOTATION_CREATED, annot);
    });

    // Anchoring an annotation in the page completed
    bridge.on('sync', function (events) {
      events.forEach(function (event) {
        inPage.add(event.tag);
        annotationUI.updateAnchorStatus(null, event.tag, event.msg.$orphan);
        $rootScope.$broadcast(events.ANNOTATIONS_SYNCED, [event.tag]);
      });
    });
  }

  /**
   * Query the Hypothesis annotation client in a frame for the URL and metadata
   * of the document that is currently loaded and add the result to the set of
   * connected frames.
   */
  function addFrame(channel) {
    channel.call('getDocumentInfo', function (err, info) {
      var searchUris = [];

      if (err) {
        channel.destroy();
      } else {
        searchUris = [info.uri];
      }

      var documentFingerprint = null;
      if (info.metadata && info.metadata.documentFingerprint) {
        documentFingerprint = info.metadata.documentFingerprint;
        searchUris = info.metadata.link.map(function (link) {
          return link.href;
        });
      }

      annotationUI.frameConnected({
        uri: info.uri,
        searchUris: searchUris,
        documentFingerprint: documentFingerprint,
      });
    });
  }

  /**
   * Find and connect to Hypothesis clients in the current window.
   */
  this.connect = function () {
    var discovery = new Discovery(window, {server: true});
    discovery.startDiscovery(bridge.createChannel.bind(bridge));
    bridge.onConnect(addFrame);

    setupSyncToPage();
    setupSyncFromPage();
  };

  /**
   * Focus annotations with the given tags.
   *
   * This is used to indicate the highlight in the page that corresponds to a
   * given annotation in the sidebar.
   *
   * @param {string[]} tags
   */
  this.focusAnnotations = function (tags) {
    bridge.call('focusAnnotations', tags);
  };

  /**
   * Scroll the page to the highlight for an annotation with a given tag.
   *
   * @param {string} tag
   */
  this.scrollToAnnotation = function (tag) {
    bridge.call('scrollToAnnotation', tag);
  };

  /**
   * List of frames that are connected to the page.
   * @type {FrameInfo}
   */
  this.frames = function () {
    return annotationUI.getState().frames;
  };
}

module.exports = sidebarPageSync;
