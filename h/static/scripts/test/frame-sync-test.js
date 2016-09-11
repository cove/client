'use strict';

describe('frameSync', function () {
  context('when annotations are loaded into the sidebar', function () {
    it('sends a "loadAnnotations" message to the page', function () {
      // TODO
    });
  });

  context('when annotations are removed from the sidebar', function () {
    it('sends a "deleteAnnotation" message to the page', function () {
      // TODO
    });
  });

  context('when a new annotation is created in the page', function () {
    it('emits a BEFORE_ANNOTATION_CREATED event', function () {
      // TODO
    });
  });

  context('when anchoring completes', function () {
    it('updates the anchoring status for the annotation', function () {
      // TODO
    });

    it('emits an ANNOTATIONS_SYNCED event', function () {
      // TODO
    });
  });

  context('when a new frame connects', function () {
    it("adds the page's metadata to the #frames list", function () {
      // TODO
    });
  });
});
