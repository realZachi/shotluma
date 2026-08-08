import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readCodexAccountState,
  type CodexAccountState,
} from './codex-app-server'
import {
  createCodexConnection,
  readCodexConnection,
  removeCodexConnection,
  writeCodexConnection,
  type CodexConnection,
} from './codex-connection'

export type CodexConnectionView =
  | { status: 'notConfigured'; connection: null; account: null; message: null }
  | { status: 'checking'; connection: CodexConnection; account: null; message: null }
  | { status: 'offline'; connection: CodexConnection; account: null; message: string }
  | { status: 'connected'; connection: CodexConnection; account: Extract<CodexAccountState, { status: 'connected' }>; message: null }
  | { status: 'signedOut'; connection: CodexConnection; account: null; message: string }
  | { status: 'apiKey'; connection: CodexConnection; account: null; message: string }
  | { status: 'unsupported'; connection: CodexConnection; account: null; message: string }

const disconnectedView = (): CodexConnectionView => ({
  status: 'notConfigured',
  connection: null,
  account: null,
  message: null,
})

const viewFromAccount = (
  connection: CodexConnection,
  account: CodexAccountState,
): CodexConnectionView => {
  if (account.status === 'connected') {
    return { status: 'connected', connection, account, message: null }
  }
  if (account.status === 'signedOut') {
    return {
      status: 'signedOut',
      connection,
      account: null,
      message: 'Codex is installed but signed out. Run codex login and choose ChatGPT.',
    }
  }
  if (account.status === 'apiKey') {
    return {
      status: 'apiKey',
      connection,
      account: null,
      message: 'Codex is using an API key. Sign in with ChatGPT to use your subscription.',
    }
  }
  return {
    status: 'unsupported',
    connection,
    account: null,
    message: 'Shotluma could not verify this Codex account.',
  }
}

const offlineMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The local Codex connector did not respond in time.'
  }
  if (error instanceof Error && !error.message.includes('Failed to fetch')) return error.message
  return 'The local Codex connector is not running yet.'
}

export const useCodexConnection = () => {
  const [view, setView] = useState<CodexConnectionView>(() => {
    const connection = readCodexConnection()
    return connection
      ? { status: 'checking', connection, account: null, message: null }
      : disconnectedView()
  })
  const revisionRef = useRef(0)

  const checkConnection = useCallback(async () => {
    const connection = readCodexConnection()
    if (!connection) {
      setView(disconnectedView())
      return
    }
    const revision = revisionRef.current + 1
    revisionRef.current = revision
    setView({ status: 'checking', connection, account: null, message: null })
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4_000)
    try {
      const account = await readCodexAccountState({
        connection,
        signal: controller.signal,
      })
      if (revisionRef.current === revision) setView(viewFromAccount(connection, account))
    } catch (error) {
      if (revisionRef.current === revision) {
        setView({
          status: 'offline',
          connection,
          account: null,
          message: offlineMessage(error),
        })
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const createSetup = useCallback(() => {
    const connection = createCodexConnection({ appOrigin: window.location.origin })
    if (!writeCodexConnection(connection)) {
      setView({
        status: 'offline',
        connection,
        account: null,
        message: 'Browser storage is unavailable, so Shotluma could not save the pairing.',
      })
      return connection
    }
    revisionRef.current += 1
    setView({
      status: 'offline',
      connection,
      account: null,
      message: 'Run the setup prompt in Codex, then check the connection.',
    })
    return connection
  }, [])

  const disconnect = useCallback(() => {
    revisionRef.current += 1
    removeCodexConnection()
    setView(disconnectedView())
  }, [])

  useEffect(() => {
    if (!readCodexConnection()) return
    const timeout = window.setTimeout(() => {
      void checkConnection()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [checkConnection])

  return {
    view,
    isConnected: view.status === 'connected',
    checkConnection,
    createSetup,
    disconnect,
  }
}
