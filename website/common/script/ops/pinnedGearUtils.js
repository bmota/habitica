import content from '../content/index';
import getItemInfo from '../libs/getItemInfo';
import { BadRequest } from '../libs/errors';
import i18n from '../i18n';
import isPinned from '../libs/isPinned';
import getOfficialPinnedItems from '../libs/getOfficialPinnedItems';

import get from 'lodash/get';
import each from 'lodash/each';
import sortBy from 'lodash/sortBy';
import lodashFind from 'lodash/find';
import reduce from 'lodash/reduce';

let sortOrder = reduce(content.gearTypes, (accumulator, val, key) => {
  accumulator[val] = key;
  return accumulator;
}, {});

function selectGearToPin (user) {
  let changes = [];

  each(content.gearTypes, (type) => {
    let found = lodashFind(content.gear.tree[type][user.stats.class], (item) => {
      return !user.items.gear.owned[item.key];
    });

    if (found) changes.push(found);
  });

  return sortBy(changes, (change) => sortOrder[change.type]);
}


function addPinnedGear (user, type, path) {
  const foundIndex = user.pinnedItems.findIndex(pinnedItem => {
    return pinnedItem.path === path;
  });

  if (foundIndex === -1) {
    user.pinnedItems.push({
      type,
      path,
    });
  }
}

function addPinnedGearByClass (user) {
  if (user.flags.classSelected) {
    let newPinnedItems = selectGearToPin(user);

    for (let item of newPinnedItems) {
      let itemInfo = getItemInfo(user, 'marketGear', item);

      addPinnedGear(user, itemInfo.pinType, itemInfo.path);
    }
  }
}

function removeItemByPath (user, path) {
  const foundIndex = user.pinnedItems.findIndex(pinnedItem => {
    return pinnedItem.path === path;
  });

  if (foundIndex >= 0) {
    user.pinnedItems.splice(foundIndex, 1);
    return true;
  }

  return false;
}

function removePinnedGearByClass (user) {
  if (user.flags.classSelected) {
    let currentPinnedItems = selectGearToPin(user);

    for (let item of currentPinnedItems) {
      let itemInfo = getItemInfo(user, 'marketGear', item);

      removeItemByPath(user, itemInfo.path);
    }
  }
}

function removePinnedGearAddPossibleNewOnes (user, itemPath, newItemKey) {
  let currentPinnedItems = selectGearToPin(user);
  let removeAndAddAllItems = false;

  for (let item of currentPinnedItems) {
    let itemInfo = getItemInfo(user, 'marketGear', item);

    if (itemInfo.path === itemPath) {
      removeAndAddAllItems = true;
      break;
    }
  }

  removeItemByPath(user, itemPath);

  if (removeAndAddAllItems) {
    // an item of the users current "new" gear was bought
    // remove the old pinned gear items and add the new gear back
    removePinnedGearByClass(user);
    user.items.gear.owned[newItemKey] = true;
    addPinnedGearByClass(user);
  } else {
    // just change the new gear to owned
    user.items.gear.owned[newItemKey] = true;
  }
}

/**
 * @returns {boolean} TRUE added the item / FALSE removed it
 */
function togglePinnedItem (user, {item, type, path}, req = {}) {
  let arrayToChange;

  if (!path) { // If path isn't passed it means an item was passed
    path = getItemInfo(user, type, item, req.language).path;
  }

  if (!item) item = get(content, path);

  if (path === 'armoire' || path === 'potion') {
    throw new BadRequest(i18n.t('cannotUnpinArmoirPotion', req.language));
  }

  let officialPinnedItems = getOfficialPinnedItems(user);

  let isOfficialPinned = officialPinnedItems.find(officialPinnedItem => {
    return officialPinnedItem.path === path;
  }) !== undefined;

  if (isOfficialPinned) {
    arrayToChange = user.unpinnedItems;
  } else {
    arrayToChange = user.pinnedItems;
  }

  const foundIndex = arrayToChange.findIndex(pinnedItem => {
    return pinnedItem.path === path;
  });

  if (foundIndex >= 0) {
    arrayToChange.splice(foundIndex, 1);
    return isOfficialPinned;
  } else {
    arrayToChange.push({path, type});
    return !isOfficialPinned;
  }
}

module.exports = {
  addPinnedGearByClass,
  addPinnedGear,
  removePinnedGearByClass,
  removePinnedGearAddPossibleNewOnes,
  togglePinnedItem,
  removeItemByPath,
  isPinned,
};
