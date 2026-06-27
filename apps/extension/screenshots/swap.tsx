import { mount } from './mount.js';
import { SwapView } from '../src/popup/views/swap-view.js';
mount(<SwapView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
