import { mount } from './mount.js';
import { MainView } from '../src/popup/views/main-view.js';
mount(<MainView onLockRequested={() => {}} onOpenSettings={() => {}} />);
