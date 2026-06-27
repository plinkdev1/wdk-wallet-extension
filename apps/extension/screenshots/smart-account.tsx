import { mount } from './mount.js';
import { SmartAccountView } from '../src/popup/views/smart-account-view.js';
mount(<SmartAccountView chain={'ethereum' as never} chainName="Ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
