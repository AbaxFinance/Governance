#!/bin/bash
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ALREADY_EXISTING_NODE_PID=$(lsof -t -i :9944 -s TCP:LISTEN)
if [ ! -z "$ALREADY_EXISTING_NODE_PID" ]; then
    echo "Killing process $ALREADY_EXISTING_NODE_PID occupying test port"
    kill $ALREADY_EXISTING_NODE_PID
fi
TMP_DIR_NAME="test-chain-state-tmp"
TEST_BP_DIR="test-chain-state-bp"
rm -rf test-chain-state*
($SCRIPT_DIR/substrate-contracts-node --dev --base-path $SCRIPT_DIR/$TMP_DIR_NAME --ws-port 9944)&
NODE_PID=$!
sleep 1 #precautiously wait for node to finish start up
npx ts-node $SCRIPT_DIR/runWithoutWarnings.ts npx ts-node $SCRIPT_DIR/tests/setup/deployTest.ts $SCRIPT_DIR/tests/setup
DEPLOY_RESULT=$?
kill $NODE_PID
if [ $DEPLOY_RESULT -ne 0 ]; then
    echo "Aborting update..."
    rm -rf $SCRIPT_DIR/$TMP_DIR_NAME
    exit 1
fi

rm -rf $SCRIPT_DIR/$TEST_BP_DIR
mv $SCRIPT_DIR/$TMP_DIR_NAME $SCRIPT_DIR/$TEST_BP_DIR
rm -rf $SCRIPT_DIR/$TMP_DIR_NAME
echo "Test db update succesful!"
exit 0