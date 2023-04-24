#!/bin/bash
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
$SCRIPT_DIR/updateTestDbBackup.sh
UPDATE_DB_RESULT=$?
if [ $UPDATE_DB_RESULT -ne 0 ]; then
    exit 1
fi
rm $SCRIPT_DIR/substrate-contracts-node.testrun*.log


export NODE_OPTIONS=$NODE_OPTIONS" --max-old-space-size=16384"
start_time=$(date +%s.%3N)
#for debugging memory leaks, unfreed handles: npx mocha => npx wtfnode node_modules/.bin/_mocha
npx ts-node $SCRIPT_DIR/runWithoutWarnings.ts npx mocha --node-option max-old-space-size=16384 --config ./.mocharc.js --exit --full-trace false --require ts-node/register 'tests/**/*.ts'
end_time=$(date +%s.%3N)
elapsed=$(echo "scale=3; $end_time - $start_time" | bc)
echo "Test execution took $elapsed seconds"
npx ts-node $SCRIPT_DIR/scripts/fixupNodeLog.ts $SCRIPT_DIR/substrate-contracts-node.testrun.log