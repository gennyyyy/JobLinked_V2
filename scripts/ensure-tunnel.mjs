#!/usr/bin/env node
// Ensures the SSH LocalForward that server/.env's DATABASE_URL (127.0.0.1:5433)
// depends on is up before the API starts. Idempotent: reuse the tunnel the
// logon task already runs, spawn `ssh -N` only when nothing is listening.
import net from 'node:net'
import { spawn } from 'node:child_process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.DB_TUNNEL_PORT ?? 5433)
const ALIAS = process.env.DB_TUNNEL_HOST ?? 'joblinked-db'

const isOpen = () =>
  new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT })
    const done = (open) => { socket.destroy(); resolve(open) }
    socket.setTimeout(500, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })

const fail = (why) => {
  console.error(`[tunnel] ${HOST}:${PORT} is not open. ${why}`)
  console.error(`[tunnel] Check that ~/.ssh/config defines "${ALIAS}" and its key is authorized in authorized_keys (run "ssh -N ${ALIAS}" to see the error).`)
  process.exit(1)
}

if (await isOpen()) {
  console.log(`[tunnel] ${HOST}:${PORT} already open`)
  process.exit(0)
}

const child = spawn('ssh', ['-N', ALIAS], { detached: true, stdio: 'ignore', windowsHide: true })
child.on('error', (err) => fail(`Could not start ssh: ${err.message}`))
child.unref()

for (let attempt = 0; attempt < 20; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (await isOpen()) {
    console.log(`[tunnel] ${HOST}:${PORT} started (pid ${child.pid} via ${ALIAS})`)
    process.exit(0)
  }
}

fail(`Timed out after 10s waiting for "ssh -N ${ALIAS}" to forward it.`)
