import routes from 'avdstudio/routes.js';
import {LayerGroup, Artwork, Animation} from 'avdstudio/model.js';

const TEST_DATA = require('avdstudio/test_searchtoback.js');

const BLANK_ARTWORK = {
  width: 24,
  height: 24,
  layers: [
  ]
};


class StudioCtrl {
  constructor($scope, $mdToast, StudioStateService) {
    this.scope_ = $scope;
    this.mdToast_ = $mdToast;
    this.loaded = true;

    this.studioState_ = StudioStateService;

    // this.studioState_.artwork = new Artwork(BLANK_ARTWORK);
    this.studioState_.artwork = new Artwork(TEST_DATA.artwork);
    this.studioState_.animations = TEST_DATA.animations.map(anim => new Animation(anim));

    $(window).on('keydown', event => {
      // delete/backspace
      if (document.activeElement.matches('input')) {
        return true;
      }

      if (event.keyCode == 32) {
        this.studioState_.playing = !this.studioState_.playing;
        return false;

      } else if (event.keyCode == 8) {
        this.deleteSelectedLayers_();
        this.deleteSelectedAnimationBlocks_();
        return false;

      } else if (event.metaKey && event.keyCode == "G".charCodeAt(0)) {
        event.shiftKey
            ? this.ungroupSelectedLayers_()
            : this.groupSelectedLayers_();
        return false;
      }
    });
  }

  deleteSelectedLayers_() {
    if (this.studioState_.selectedLayers.length) {
      // delete layers
      this.studioState_.deleteLayers(this.studioState_.selectedLayers);
      this.studioState_.selectedLayers = null;
      this.studioState_.artworkChanged();
      this.studioState_.animChanged();
    }
  }

  deleteSelectedAnimationBlocks_() {
    if (this.studioState_.selectedAnimationBlocks.length) {
      // delete animations
      let selectedAnimationBlocks = this.studioState_.selectedAnimationBlocks;
      this.studioState_.animations.forEach(animation => {
        for (let i = animation.blocks.length - 1; i >= 0; --i) {
          let block = animation.blocks[i];
          if (selectedAnimationBlocks.indexOf(block) >= 0) {
            animation.blocks.splice(i, 1);
          }
        }
      });

      this.studioState_.selectedAnimationBlocks = null;
      this.studioState_.animChanged();
      return false;
    }
  }

  groupOrUngroupSelectedLayers_(shouldGroup) {
    if (this.studioState_.selectedLayers.length) {
      // sort selected layers by order they appear in tree
      let tempSelLayers = this.studioState_.selectedLayers.slice();
      let selLayerOrders = {};
      let n = 0;
      this.studioState_.artwork.walk(layer => {
        if (tempSelLayers.indexOf(layer) >= 0) {
          selLayerOrders[layer.id] = n;
          ++n;
        }
      });
      tempSelLayers.sort((a, b) => selLayerOrders[a.id] - selLayerOrders[b.id]);

      // either group or ungroup selection
      if (shouldGroup) {
        // group selected layers

        // remove any layers that are descendants of other selected layers
        tempSelLayers = tempSelLayers.filter(layer => {
          let p = layer.parent;
          while (p) {
            if (tempSelLayers.indexOf(p) >= 0) {
              return false;
            }
            p = p.parent;
          }
          return true;
        });

        // find destination parent and insertion point
        let firstSelectedLayerParent = tempSelLayers[0].parent;
        let firstSelectedLayerIndexInParent
            = firstSelectedLayerParent.layers.indexOf(tempSelLayers[0]);

        // remove all selected items from their parents and
        // move them into a new parent
        let newGroup = new LayerGroup({
          id: this.studioState_.makeNewLayerId('group'),
          layers: tempSelLayers
        });
        tempSelLayers.forEach(layer =>
            layer.parent.layers.splice(layer.parent.layers.indexOf(layer), 1));
        newGroup.parent = firstSelectedLayerParent;
        firstSelectedLayerParent.layers.splice(firstSelectedLayerIndexInParent, 0, newGroup);

        this.studioState_.artworkChanged();
        this.studioState_.animChanged();
        this.studioState_.selectedLayers = [newGroup];

      } else {
        // ungroup selected layer groups
        let newSelectedLayers = [];
        tempSelLayers
            .filter(layer => layer instanceof LayerGroup)
            .forEach(layerGroup => {
              // move children into parent
              let parent = layerGroup.parent;
              let indexInParent = Math.max(0, parent.layers.indexOf(layerGroup));
              parent.layers.splice(indexInParent, 0, ...layerGroup.layers);
              newSelectedLayers.splice(0, 0, ...layerGroup.layers);
              layerGroup.layers.forEach(layer => layer.parent = parent);
              layerGroup.layers = [];

              // delete the parent
              this.studioState_.deleteLayers(layerGroup);

              this.studioState_.artworkChanged();
              this.studioState_.animChanged();
            });
        this.studioState_.selectedLayers = newSelectedLayers;
      }
    }
  }

  groupSelectedLayers_() {
    this.groupOrUngroupSelectedLayers_(true);
  }

  ungroupSelectedLayers_() {
    this.groupOrUngroupSelectedLayers_(false);
  }
}


angular.module('AVDStudio').controller('StudioCtrl', StudioCtrl);
