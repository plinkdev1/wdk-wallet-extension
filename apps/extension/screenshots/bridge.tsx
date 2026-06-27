import { mount } from './mount.js';
import { BridgeView } from '../src/popup/views/bridge-view.js';
mount(<BridgeView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} ownAddress="0x70997970C51812dc3A010C7d01b50e0d17dc79C8" onBack={() => {}} />);
