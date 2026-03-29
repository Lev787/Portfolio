const screens = {
  home: document.getElementById('screen-home'),
  avatar: document.getElementById('screen-avatar'),
  editAvatar: document.getElementById('screen-edit-avatar'),
};

const navItems = Array.from(document.querySelectorAll('.nav-item'));
const openEditAvatarBtn = document.getElementById('openEditAvatar');
const backToAvatarBtn = document.getElementById('backToAvatar');
const saveAvatarBtn = document.getElementById('saveAvatar');
const inventoryGrid = document.getElementById('inventoryGrid');
const avatarPreviewMainHat = document.getElementById('avatarPreviewMainHat');
const avatarPreviewEditHat = document.getElementById('avatarPreviewEditHat');
const selectedItemTitle = document.getElementById('selectedItemTitle');
const selectedItemImage = document.getElementById('selectedItemImage');
const selectedItemBoost = document.getElementById('selectedItemBoost');
const selectedItemDurability = document.getElementById('selectedItemDurability');
const durabilityFill = document.getElementById('durabilityFill');

const appState = {
  activeScreen: 'home',
  selectedHatSrc: 'assets/knight-ironhat.png',
  selectedHatName: 'Hornbreaker helm',
  selectedHatBoost: '12 XP/min',
  selectedHatDurability: '1.4 hours',
  selectedHatColor: '#9ea6b5',
  selectedHatFill: '40',
};

function getNavIconSrc(target, isActive) {
  if (target === 'home') {
    return isActive ? 'assets/home-selected.png' : 'assets/home-unselected.png';
  }

  if (target === 'avatar') {
    return isActive ? 'assets/people-selected.png' : 'assets/people-unselected.png';
  }

  if (target === 'market') {
    return 'assets/cup-unselected.png';
  }

  if (target === 'trade') {
    return 'assets/gamepad-unselected.png';
  }

  return '';
}

function showScreen(screenKey) {
  if (screens.home) screens.home.classList.remove('is-active');
  if (screens.avatar) screens.avatar.classList.remove('is-active');
  if (screens.editAvatar) screens.editAvatar.classList.remove('is-active');

  if (screenKey === 'home') screens.home.classList.add('is-active');
  if (screenKey === 'avatar') screens.avatar.classList.add('is-active');
  if (screenKey === 'editAvatar') screens.editAvatar.classList.add('is-active');

  appState.activeScreen = screenKey;

  navItems.forEach((item) => {
    const target = item.dataset.target;
    const isActive = target === 'home' ? screenKey === 'home' : target === 'avatar' && screenKey !== 'home';
    item.classList.toggle('is-active', isActive);

    const navIcon = item.querySelector('img');
    if (navIcon) {
      navIcon.src = getNavIconSrc(target, isActive);
    }
  });
}

function renderAvatar() {
  avatarPreviewMainHat.src = appState.selectedHatSrc;
  avatarPreviewEditHat.src = appState.selectedHatSrc;
  if(selectedItemImage) selectedItemImage.src = appState.selectedHatSrc || 'assets/knight-ironhat.png';
  selectedItemTitle.textContent = appState.selectedHatName;
  selectedItemBoost.textContent = `XP boost: ${appState.selectedHatBoost}`;
  selectedItemDurability.textContent = `Durability: ${appState.selectedHatDurability}`;
  if(durabilityFill) {
    if (appState.selectedHatFill === '0') {
      durabilityFill.style.width = '0%';
    } else {
      durabilityFill.style.width = `${appState.selectedHatFill}%`;
      durabilityFill.style.backgroundColor = appState.selectedHatColor;
    }
  }

  const hasHat = Boolean(appState.selectedHatSrc);
  avatarPreviewMainHat.classList.toggle('is-hidden', !hasHat);
  avatarPreviewEditHat.classList.toggle('is-hidden', !hasHat);

  const isLargeHelmet = appState.selectedHatSrc.includes('knight-ironhat') || appState.selectedHatSrc.includes('space-hat');
  avatarPreviewMainHat.classList.toggle('is-large-helmet', isLargeHelmet);
  avatarPreviewEditHat.classList.toggle('is-large-helmet', isLargeHelmet);

  const isMageHat = appState.selectedHatSrc.includes('magical-hat');
  avatarPreviewMainHat.classList.toggle('is-mage-hat', isMageHat);
  avatarPreviewEditHat.classList.toggle('is-mage-hat', isMageHat);
}

function selectInventoryItem(button) {
  const hatSrc = button.dataset.hatSrc ?? '';
  const name = button.dataset.name;
  const boost = button.dataset.boost;
  const durability = button.dataset.durability;
  const color = button.dataset.color || '#8f9dff';
  const fill = button.dataset.fill || '0';

  appState.selectedHatSrc = hatSrc;
  appState.selectedHatName = name;
  appState.selectedHatBoost = boost;
  appState.selectedHatDurability = durability;
  appState.selectedHatColor = color;
  appState.selectedHatFill = fill;

  document.querySelectorAll('.item-slot').forEach((slot) => slot.classList.remove('is-selected'));
  button.classList.add('is-selected');

  renderAvatar();
}

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const target = item.dataset.target;

    if (target === 'home') {
      showScreen('home');
      return;
    }

    if (target === 'avatar') {
      showScreen('avatar');
      return;
    }

    // Market and Trade point to avatar screen in this simplified flow.
    showScreen('avatar');
  });
});

openEditAvatarBtn.addEventListener('click', () => {
  showScreen('editAvatar');
});

backToAvatarBtn.addEventListener('click', () => {
  showScreen('avatar');
});

saveAvatarBtn.addEventListener('click', () => {
  saveAvatarBtn.textContent = 'Saved';
  saveAvatarBtn.style.background = '#8ef2a7';
  saveAvatarBtn.style.color = '#172124';

  setTimeout(() => {
    saveAvatarBtn.textContent = 'Save';
    saveAvatarBtn.style.background = '#edf2ff';
    saveAvatarBtn.style.color = '#191c2d';
    showScreen('avatar');
  }, 550);
});

inventoryGrid.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest('.item-slot');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  selectInventoryItem(button);
});

const defaultItem = inventoryGrid.querySelector('.item-slot');
if (defaultItem) {
  defaultItem.classList.add('is-selected');
}

function updateBottomNavVisibility() {
  const bottomNav = document.querySelector('.bottom-nav');
  if (!bottomNav) return;
  if (appState.activeScreen === 'editAvatar') {
    bottomNav.style.display = 'none';
  } else {
    bottomNav.style.display = '';
  }
}

// Patch showScreen to also update nav visibility
const _originalShowScreen = showScreen;
showScreen = function(screenKey) {
  _originalShowScreen(screenKey);
  updateBottomNavVisibility();
};

// Call once on load
updateBottomNavVisibility();

renderAvatar();
showScreen('home');
