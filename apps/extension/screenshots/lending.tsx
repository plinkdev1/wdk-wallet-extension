import { mount } from './mount.js';
import { LendingView } from '../src/popup/views/lending-view.js';
mount(<LendingView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
