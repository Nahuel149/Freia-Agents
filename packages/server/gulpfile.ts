import { dest, src } from 'gulp'

// OSS mode - no email templates to copy
function noOp() {
    return Promise.resolve()
}

exports.default = noOp
