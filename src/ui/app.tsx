/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';

import { TTNguyenTokenWrapper } from '../lib/contracts/TTNguyenToken';
import { CONFIG } from '../config';

const CompiledContractArtifact = require(`../../build/contracts/ERC20.json`);
const SUDT_ADDRESS = '0xFbbbC57d2a5EbEAD4eAcf81d067b8f0155a6a93B';
const FORCE_BRIDGE_URL =
    'https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos?xchain-asset=0x0000000000000000000000000000000000000000';

async function createWeb3() {
    // Modern dapp browsers...
    const { ethereum } = window as any;
    if (ethereum && ethereum.isMetaMask) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<TTNguyenTokenWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);
    const [toAddressInputValue, setToAddressInputValue] = useState<string>();
    const [amountInputValue, setAmountInputValue] = useState<number>();
    const [tokenName, setTokenName] = useState<string | undefined>();
    const [tokenSymbol, setTokenSymbol] = useState<string | undefined>();
    const [totalSupplyToken, setTotalSupplyToken] = useState<string | undefined>();

    const [l2Address, setL2Address] = useState<string | undefined>();
    const [sudtBalance, setSudtBalance] = useState<number | 0>();

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    async function deployContract() {
        const _contract = new TTNguyenTokenWrapper(web3);

        try {
            setDeployTxHash(undefined);
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);

            setDeployTxHash(transactionHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    async function getTotalSupplyToken() {
        const value = await contract.getTotalSupply();
        setTotalSupplyToken(value);
    }

    async function getTokenSymbolValue() {
        const value = await contract.getTokenSymbol();
        setTokenSymbol(value);
    }

    async function getTokenNameValue() {
        const value = await contract.getTokenName();
        setTokenName(value);
    }

    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new TTNguyenTokenWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        setContract(_contract);
    }

    async function setTransferTokenAmount() {
        try {
            setTransactionInProgress(true);
            await contract.setTransferToken(account, toAddressInputValue, amountInputValue);
            toast('Successfully tranfer token', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    // Get L2 Address for Force Bridge
    async function getL2Address(_web3: Web3, _account: string) {
        console.log(`getL2Address: \n${_web3}`);
        const addressTranslator = new AddressTranslator();
        const depositAddress = await addressTranslator.getLayer2DepositAddress(_web3, _account);

        console.log(`Layer 2 Deposit Address on Layer 1: \n${depositAddress.addressString}`);
        return depositAddress.addressString;
    }

    async function getSUDTBalance(_web3: Web3, _account: string, _polyjuiceAddress: string) {
        console.log(`PolyjuiceAddress: \n${_polyjuiceAddress}`);

        const _contract = new _web3.eth.Contract(CompiledContractArtifact.abi, SUDT_ADDRESS);
        const balance = await _contract.methods.balanceOf(_polyjuiceAddress).call({
            from: account
        });
        return balance;
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);

                const _l2Address = await getL2Address(_web3, _accounts[0]);
                setL2Address(_l2Address);

                const addressTranslator = new AddressTranslator();
                const _polyjuiceAddress = addressTranslator.ethAddressToGodwokenShortAddress(
                    _accounts[0]
                );

                console.log(`Polyjuice Address: ${_polyjuiceAddress}\n`);
                console.log(
                    `Checking SUDT balance using proxy contract with address: ${SUDT_ADDRESS}...`
                );
                const _balance = await getSUDTBalance(_web3, _accounts[0], _polyjuiceAddress);
                setSudtBalance(_balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">??</span>;

    const redirect2Bridge = () => {
        window.location.href = FORCE_BRIDGE_URL;
    };

    return (
        <div>
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            Nervos Layer 2 balance:{' '}
            <b>{l2Balance ? (l2Balance / 10n ** 8n).toString() : <LoadingIndicator />} CKB</b>
            <br />
            <br />
            Deployed contract address: <b>{contract?.address || '-'}</b> <br />
            Deploy transaction hash: <b>{deployTxHash || '-'}</b>
            {l2Address && (
                <div>
                    <h4>L2 deposit address on L1</h4>
                    <span className="multiline">{l2Address}</span>
                </div>
            )}
            <br />
            {sudtBalance && (
                <div className="show-addr mb-2">
                    SUDT Balance: <b>{sudtBalance}</b>
                </div>
            )}
            <br />
            <hr />
            <p>The button below will deploy a ERC20 token.</p>
            <button type="button" className="fill" onClick={deployContract} disabled={!l2Balance}>
                Deploy contract
            </button>
            &nbsp;or&nbsp;
            <input
                placeholder="Existing contract id"
                onChange={e => setExistingContractIdInputValue(e.target.value)}
            />
            <button
                type="button"
                className="fill"
                disabled={!existingContractIdInputValue || !l2Balance}
                onClick={() => setExistingContractAddress(existingContractIdInputValue)}
            >
                Use existing contract
            </button>
            <br />
            <br />
            <button type="button" className="fill" onClick={getTokenNameValue} disabled={!contract}>
                Get token name
            </button>
            {tokenName ? <>&nbsp;Token Name: {tokenName}</> : null}
            <br />
            <br />
            <button
                type="button"
                className="fill"
                onClick={getTokenSymbolValue}
                disabled={!contract}
            >
                Get token symbol
            </button>
            {tokenSymbol ? <>&nbsp;Token Symbol: {tokenSymbol}</> : null}
            <br />
            <br />
            <button
                type="button"
                className="fill"
                onClick={getTotalSupplyToken}
                disabled={!contract}
            >
                Get total supply
            </button>
            {totalSupplyToken ? (
                <>&nbsp;Total Supply: {web3.utils.fromWei(totalSupplyToken)}</>
            ) : null}
            <br />
            <br />
            <input
                type="text"
                placeholder="To Address"
                onChange={e => setToAddressInputValue(e.target.value)}
            />{' '}
            <input
                type="text"
                placeholder="Amount"
                onChange={e => setAmountInputValue(Number(e.target.value))}
            />{' '}
            <button
                type="button"
                className="fill"
                onClick={setTransferTokenAmount}
                disabled={!contract}
            >
                Transfer
            </button>
            <div className="container">
                <button
                    className="myButton"
                    data-label="Go To Force Bridge"
                    onClick={redirect2Bridge}
                    disabled={!l2Address}
                ></button>
            </div>
            <br />
            <hr />
            The contract is deployed on Nervos Layer 2 - Godwoken + Polyjuice. After each
            transaction you might need to wait up to 120 seconds for the status to be reflected.
            <ToastContainer />
        </div>
    );
}
