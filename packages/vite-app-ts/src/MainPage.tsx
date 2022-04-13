import React, { FC, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';

import '~~/styles/main-page.css';

import { GenericContract } from 'eth-components/ant/generic-contract';
import {
  useContractReader,
  useBalance,
  useEthersAdaptorFromProviderOrSigners,
  useEventListener,
  useGasPrice,
} from 'eth-hooks';
import { useEthersContext } from 'eth-hooks/context';
import { useDexEthPrice } from 'eth-hooks/dapps';
import { asEthersAdaptor } from 'eth-hooks/functions';

import { MainPageMenu, MainPageFooter, MainPageHeader } from './components/main';
import { useScaffoldHooksExamples as useScaffoldHooksExamples } from './components/main/hooks/useScaffoldHooksExamples';

import { useBurnerFallback } from '~~/components/main/hooks/useBurnerFallback';
import { useScaffoldProviders as useScaffoldAppProviders } from '~~/components/main/hooks/useScaffoldAppProviders';
import { Hints, ExampleUI } from '~~/components/pages';
import { BURNER_FALLBACK_ENABLED, MAINNET_PROVIDER } from '~~/config/appConfig';
import { useAppContracts, useConnectAppContracts, useLoadAppContracts } from '~~/config/contractContext';
import { NETWORKS } from '~~/models/constants/networks';

import { Button, Input, Spin } from 'antd';
import { transactor } from 'eth-components/functions';
import { EthComponentsSettingsContext } from 'eth-components/models';

// const yourTokenAddress = '0xd74E9aCdc4f4DAd774f66C47Be87DDBE023c968d';
// const targetL1 = NETWORKS.kovan;
// const l1Provider = new ethers.providers.JsonRpcProvider(targetL1.rpcUrl);
enum L2DeployState {
  NOT_STARTED,
  DEPLOYING,
  DEPLOYED,
}

/**
 * ⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️
 * See config/appConfig.ts for configuration, such as TARGET_NETWORK
 * See MainPageContracts.tsx for your contracts component
 * See contractsConnectorConfig.ts for how to configure your contracts
 * ⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️⛳️
 *
 * For more
 */

/**
 * The main component
 * @returns
 */
export const Main: FC = () => {
  // -----------------------------
  // Providers, signers & wallets
  // -----------------------------
  // 🛰 providers
  // see useLoadProviders.ts for everything to do with loading the right providers
  const scaffoldAppProviders = useScaffoldAppProviders();

  // 🦊 Get your web3 ethers context from current providers
  const ethersContext = useEthersContext();

  const ethComponentsSettings = useContext(EthComponentsSettingsContext);
  const [gasPrice] = useGasPrice(ethersContext.chainId, 'fast');
  const tx = transactor(ethComponentsSettings, ethersContext?.signer, gasPrice);

  // if no user is found use a burner wallet on localhost as fallback if enabled
  useBurnerFallback(scaffoldAppProviders, BURNER_FALLBACK_ENABLED);

  // -----------------------------
  // Load Contracts
  // -----------------------------
  // 🛻 load contracts
  useLoadAppContracts();
  // 🏭 connect to contracts for mainnet network & signer
  const [mainnetAdaptor] = useEthersAdaptorFromProviderOrSigners(MAINNET_PROVIDER);
  useConnectAppContracts(mainnetAdaptor);
  // 🏭 connec to  contracts for current network & signer
  useConnectAppContracts(asEthersAdaptor(ethersContext));

  // -----------------------------
  // Hooks use and examples
  // -----------------------------
  // 🎉 Console logs & More hook examples:
  // 🚦 disable this hook to stop console logs
  // 🏹🏹🏹 go here to see how to use hooks!
  useScaffoldHooksExamples(scaffoldAppProviders);

  // -----------------------------
  // These are the contracts!
  // -----------------------------

  // init contracts
  const yourContract = useAppContracts('YourContract', ethersContext.chainId);
  const yourTokenContract = useAppContracts('YourToken', NETWORKS.kovan.chainId);
  const mainnetDai = useAppContracts('DAI', NETWORKS.mainnet.chainId);
  const tokenFactory = useAppContracts('L2TokenFactory', NETWORKS.kovanOptimism.chainId);

  // keep track of a variable from the contract in the local React state:
  const [purpose, update] = useContractReader(
    yourContract,
    yourContract?.purpose,
    [],
    yourContract?.filters.SetPurpose()
  );

  // 📟 Listen for broadcast events
  const [setPurposeEvents] = useEventListener(yourContract, 'SetPurpose', 0);

  // -----------------------------
  // .... 🎇 End of examples
  // -----------------------------
  // 💵 This hook will get the price of ETH from 🦄 Uniswap:
  const [ethPrice] = useDexEthPrice(scaffoldAppProviders.mainnetAdaptor?.provider, scaffoldAppProviders.targetNetwork);

  // 💰 this hook will get your balance
  const [yourCurrentBalance] = useBalance(ethersContext.account);

  const [route, setRoute] = useState<string>('');
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  const [l1TokenAddress, setL1TokenAddress] = useState<string>('');
  const [l2TokenAddress, setL2TokenAddress] = useState<string>('');

  const [deployState, setDeployState] = useState<L2DeployState>(L2DeployState.NOT_STARTED);
  let l2DeployView = <></>;
  switch (deployState) {
    case L2DeployState.NOT_STARTED:
      l2DeployView = <></>;
      break;
    case L2DeployState.DEPLOYING:
      l2DeployView = <Spin />;
      break;
    case L2DeployState.DEPLOYED:
      l2DeployView = <Input value={l2TokenAddress} />;
      break;
  }

  const deployToL2 = async (): Promise<void> => {
    setDeployState(L2DeployState.DEPLOYING);
    const result = await tx?.(tokenFactory?.createStandardL2Token(l1TokenAddress, 'GOLD', 'GLD'));
    console.log(result);
    if (!result || result.code === 4001) {
      setDeployState(L2DeployState.NOT_STARTED);
      return;
    }

    const receipt = await result.wait();
    console.log(receipt);

    const args = receipt.events.find(({ event }) => event === 'StandardL2TokenCreated').args;

    // Get the L2 token address from the emmited event and log
    const address: string = args._l2Token;
    setL2TokenAddress(address);
    setDeployState(L2DeployState.DEPLOYED);
    console.log('L2StandardERC20 deployed to:', l2TokenAddress);
  };

  return (
    <div className="App">
      <MainPageHeader scaffoldAppProviders={scaffoldAppProviders} price={ethPrice} />

      {/* Routes should be added between the <Switch> </Switch> as seen below */}
      <BrowserRouter>
        <MainPageMenu route={route} setRoute={setRoute} />
        <Switch>
          <Route exact path="/">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px',
                  width: '500px',
                }}>
                <Input
                  placeholder="L1 Token Address"
                  value={l1TokenAddress}
                  onChange={(e): void => setL1TokenAddress(e.target.value)}
                />
                <Button type="primary" onClick={deployToL2}>
                  Deploy to L2
                </Button>
                {l2DeployView}
              </div>
            </div>
            {/* <MainPageContracts scaffoldAppProviders={scaffoldAppProviders} /> */}
          </Route>
          {/* you can add routes here like the below examlples */}
          <Route path="/hints">
            <Hints
              address={ethersContext?.account ?? ''}
              yourCurrentBalance={yourCurrentBalance}
              mainnetProvider={scaffoldAppProviders.mainnetAdaptor?.provider}
              price={ethPrice}
            />
          </Route>
          <Route path="/exampleui">
            <ExampleUI
              mainnetProvider={scaffoldAppProviders.mainnetAdaptor?.provider}
              yourCurrentBalance={yourCurrentBalance}
              price={ethPrice}
            />
          </Route>
          <Route path="/mainnetdai">
            {MAINNET_PROVIDER != null && (
              <GenericContract
                contractName="DAI"
                contract={mainnetDai}
                mainnetAdaptor={scaffoldAppProviders.mainnetAdaptor}
                blockExplorer={NETWORKS.mainnet.blockExplorer}
              />
            )}
          </Route>
          {/* Subgraph also disabled in MainPageMenu, it does not work, see github issue! */}
          {/*
          <Route path="/subgraph">
            <Subgraph subgraphUri={subgraphUri} mainnetProvider={scaffoldAppProviders.mainnetAdaptor?.provider} />
          </Route>
          */}
        </Switch>
      </BrowserRouter>

      <MainPageFooter scaffoldAppProviders={scaffoldAppProviders} price={ethPrice} />
    </div>
  );
};
