import { useEffect, useState } from 'react'
import { sendFeishuConnectionTest } from '../lib/feishu'
import { createSyncSpaceId, isSyncEnvReady, syncSetupSql } from '../lib/sync'
import { Field, Fold, Note, Section, Segmented, Toggle } from '../ui/primitives'
import { ACCENTS, APPEARANCES } from '../ui/theme'
import { splitLines } from './helpers'
import type { Appearance } from '../ui/theme'
import type { ViewProps } from './types'

export function SettingsView({ life, runtime }: ViewProps) {
  const { data, sync, actions } = life
  const { settings } = data

  const [focusMinutes, setFocusMinutes] = useState(String(settings.focusMinutes))
  const [breakMinutes, setBreakMinutes] = useState(String(settings.breakMinutes))

  const [blocked, setBlocked] = useState(settings.blockedTargets.join('\n'))
  const [spaceId, setSpaceId] = useState(settings.syncSpaceId)
  const [deviceName, setDeviceName] = useState(settings.syncDeviceName)

  const [webhook, setWebhook] = useState(settings.feishuWebhookUrl)
  const [keyword, setKeyword] = useState(settings.feishuKeyword)
  const [secret, setSecret] = useState(settings.feishuSecret)
  const [testing, setTesting] = useState(false)
  const [testNote, setTestNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setSpaceId(settings.syncSpaceId)
    setDeviceName(settings.syncDeviceName)
  }, [settings.syncSpaceId, settings.syncDeviceName])

  const saveRhythm = () => {
    actions.updateSettings({
      focusMinutes: Number(focusMinutes) || settings.focusMinutes,
      breakMinutes: Number(breakMinutes) || settings.breakMinutes,
    })
    runtime.notify('已保存。', 'success')
  }

  const saveFeishu = () => {
    actions.updateSettings({ feishuWebhookUrl: webhook.trim(), feishuKeyword: keyword.trim(), feishuSecret: secret.trim() })
    runtime.notify('飞书配置已保存。', 'success')
  }

  const testFeishu = async () => {
    if (!webhook.trim()) {
      setTestNote({ tone: 'error', text: '先填 webhook 地址。' })
      return
    }

    setTesting(true)
    setTestNote(null)
    saveFeishu()

    try {
      await sendFeishuConnectionTest({ webhookUrl: webhook.trim(), keyword: keyword.trim(), secret: secret.trim() })
      setTestNote({ tone: 'success', text: '连接成功，机器人收到测试消息了。' })
    } catch (error) {
      setTestNote({ tone: 'error', text: error instanceof Error ? error.message : '连接失败。' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Section title="外观" desc="明暗跟随系统，或自己钉死。">
        <Segmented
          value={(settings.appearance ?? 'auto') as Appearance}
          onChange={(next) => actions.updateSettings({ appearance: next })}
          options={APPEARANCES.map((item) => ({ value: item.id, label: item.label }))}
        />
        <div className="accents">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              className={settings.theme === accent.id ? 'accent on' : 'accent'}
              aria-label={accent.label}
              aria-pressed={settings.theme === accent.id}
              style={{ ['--dot' as string]: accent.accent }}
              onClick={() => actions.updateSettings({ theme: accent.id })}
            />
          ))}
        </div>
        {runtime.install.available ? (
          <button type="button" className="btn sm" onClick={() => void runtime.install.prompt()}>
            安装到桌面 / 主屏
          </button>
        ) : null}
      </Section>

      <Section title="节奏" desc="今天只有一件事，不可配置。这里只调专注和休息的分钟数。">
        <div className="quad">
          <Field label="专注（分）">
            <input value={focusMinutes} inputMode="numeric" onChange={(event) => setFocusMinutes(event.target.value)} />
          </Field>
          <Field label="休息（分）">
            <input value={breakMinutes} inputMode="numeric" onChange={(event) => setBreakMinutes(event.target.value)} />
          </Field>
        </div>
        <button type="button" className="btn sm" onClick={saveRhythm}>
          保存
        </button>
      </Section>

      <Section title="提醒" desc="番茄结束、生活到点、晚间复盘、硬性收工，都从这里开关。生活类只靠这些提醒推进，不在今天页占行。">
        <Toggle
          checked={settings.desktopNotificationsEnabled}
          disabled={!runtime.desktop.supported}
          onChange={(next) => actions.updateSettings({ desktopNotificationsEnabled: next })}
        >
          电脑消息提醒
        </Toggle>
        <p className="row">
          <button type="button" className="link" disabled={!runtime.desktop.supported} onClick={() => void runtime.desktop.request()}>
            申请权限
          </button>
          <button type="button" className="link" disabled={!runtime.desktop.supported} onClick={() => void runtime.desktop.test()}>
            发一条测试
          </button>
        </p>
        <Note tone={runtime.desktop.active ? 'success' : 'muted'}>{runtime.desktop.statusText}</Note>

        <Toggle checked={settings.mobileTimerEnabled} onChange={(next) => actions.updateSettings({ mobileTimerEnabled: next })}>
          手机原生提醒（锁屏可收）
        </Toggle>
        <p className="row">
          <button type="button" className="link" onClick={() => void runtime.native.enable()}>
            申请权限
          </button>
          <button type="button" className="link" onClick={() => void runtime.native.test()}>
            15 秒测试
          </button>
          <button type="button" className="link" onClick={() => void runtime.native.openSystemAlarmSettings()}>
            系统闹钟设置
          </button>
        </p>
        {runtime.native.message ? <Note tone={runtime.native.status === 'error' ? 'error' : 'success'}>{runtime.native.message}</Note> : null}

        <div className="pair">
          <Field label="复盘提醒">
            <input type="time" value={settings.reviewReminderTime} onChange={(event) => actions.updateSettings({ reviewReminderTime: event.target.value })} />
          </Field>
          <Field label="硬性收工">
            <input type="time" value={settings.hardStopTime} onChange={(event) => actions.updateSettings({ hardStopTime: event.target.value })} />
          </Field>
        </div>
        <Toggle checked={settings.reviewReminderEnabled} onChange={(next) => actions.updateSettings({ reviewReminderEnabled: next })}>
          开启复盘提醒
        </Toggle>
        <Toggle checked={settings.hardStopEnabled} onChange={(next) => actions.updateSettings({ hardStopEnabled: next })}>
          开启收工提示
        </Toggle>
      </Section>

      <Fold title="专注阻断" count="安卓" desc="专注时把黑名单应用挡回来，只在安卓安装包里生效。">
        <Toggle checked={settings.appLockEnabled} onChange={(next) => actions.updateSettings({ appLockEnabled: next })}>
          专注时锁定黑名单应用
        </Toggle>
        <Field label="干预等级">
          <select value={settings.blockerLevel} onChange={(event) => actions.updateSettings({ blockerLevel: event.target.value as 'light' | 'soft' | 'hard' })}>
            <option value="light">轻提醒</option>
            <option value="soft">软阻断</option>
            <option value="hard">硬阻断</option>
          </select>
        </Field>
        <Field label="要防的应用 / 网站" hint="每行一项">
          <textarea
            rows={4}
            value={blocked}
            onChange={(event) => {
              setBlocked(event.target.value)
              actions.updateSettings({ blockedTargets: splitLines(event.target.value) })
            }}
          />
        </Field>
        <p className="row">
          <button type="button" className="link" onClick={() => void runtime.focusLock.openSettings()}>
            打开无障碍设置
          </button>
          <button type="button" className="link" onClick={() => void runtime.focusLock.check()}>
            检查状态
          </button>
        </p>
        <Note tone={runtime.focusLock.status === 'error' ? 'error' : 'muted'}>
          {runtime.focusLock.message ||
            (runtime.focusLock.available ? (runtime.focusLock.serviceEnabled ? '应用锁定服务已开启。' : '还没开启应用锁定服务。') : '只在安卓安装包里可用。')}
        </Note>
      </Fold>

      <Fold title="跨设备同步" desc="两台设备填同一个空间码，就共用一份数据。只在一台上用可以不管。">
        <Toggle checked={settings.syncEnabled} onChange={(next) => actions.updateSettings({ syncEnabled: next })}>
          手机和电脑共用一份数据
        </Toggle>
        <div className="pair">
          <Field label="设备名">
            <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="家里电脑" />
          </Field>
          <Field label="同步空间码">
            <input className="mono" value={spaceId} onChange={(event) => setSpaceId(event.target.value.toUpperCase())} placeholder="ABCD-EFGH" />
          </Field>
        </div>
        <p className="row wrap">
          <button
            type="button"
            className="link"
            onClick={() => {
              const next = createSyncSpaceId()
              setSpaceId(next)
              actions.updateSettings({ syncEnabled: true, syncSpaceId: next, syncDeviceName: deviceName.trim() || settings.syncDeviceName })
            }}
          >
            生成同步码
          </button>
          <button
            type="button"
            className="link"
            disabled={!spaceId.trim()}
            onClick={() => {
              void navigator.clipboard.writeText(spaceId.trim().toUpperCase())
              runtime.notify('已复制。', 'info')
            }}
          >
            复制
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              actions.updateSettings({ syncSpaceId: spaceId.trim().toUpperCase(), syncDeviceName: deviceName.trim() || settings.syncDeviceName })
              void sync.pullFromCloud('manual').catch(() => undefined)
            }}
          >
            从云端拉取
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              actions.updateSettings({ syncSpaceId: spaceId.trim().toUpperCase(), syncDeviceName: deviceName.trim() || settings.syncDeviceName })
              void sync.pushToCloud('manual').catch(() => undefined)
            }}
          >
            上传本机
          </button>
        </p>
        {sync.message ? <Note tone={sync.status === 'error' ? 'error' : 'success'}>{sync.message}</Note> : null}
        {!isSyncEnvReady() ? <Note tone="error">还要先在 .env 填 Supabase 地址和 key。</Note> : null}
        <details className="mini">
          <summary>Supabase 建表 SQL</summary>
          <pre className="code">{syncSetupSql}</pre>
          <button
            type="button"
            className="link"
            onClick={() => {
              void navigator.clipboard.writeText(syncSetupSql)
              runtime.notify('SQL 已复制。', 'info')
            }}
          >
            复制 SQL
          </button>
        </details>
      </Fold>

      <Fold title="飞书日报" desc="把每天的记录推到飞书群机器人。纯可选。">
        <Field label="webhook 地址">
          <input className="mono" value={webhook} onChange={(event) => setWebhook(event.target.value)} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
        </Field>
        <div className="pair">
          <Field label="关键词" hint="可选">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </Field>
          <Field label="签名密钥" hint="可选">
            <input className="mono" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </Field>
        </div>
        <Toggle checked={settings.feishuAutoSyncReview} onChange={(next) => actions.updateSettings({ feishuAutoSyncReview: next })}>
          保存复盘后自动同步
        </Toggle>
        <Toggle checked={settings.feishuScheduledSyncEnabled} onChange={(next) => actions.updateSettings({ feishuScheduledSyncEnabled: next })}>
          每天固定时间自动提交
        </Toggle>
        <Field label="提交时间">
          <input type="time" value={settings.feishuScheduledSyncTime} onChange={(event) => actions.updateSettings({ feishuScheduledSyncTime: event.target.value || '12:00' })} />
        </Field>
        <p className="row">
          <button type="button" className="btn sm" onClick={() => void testFeishu()} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button type="button" className="link" onClick={saveFeishu}>
            保存
          </button>
        </p>
        {testNote ? <Note tone={testNote.tone}>{testNote.text}</Note> : null}
      </Fold>

      <Section>
        <button
          type="button"
          className="link danger"
          onClick={() => {
            if (!window.confirm('清空全部数据？任务、复盘、历史都会删除，无法撤销。')) return
            actions.resetAll()
            runtime.notify('已重置。', 'warning')
          }}
        >
          重置全部数据
        </button>
      </Section>
    </>
  )
}
