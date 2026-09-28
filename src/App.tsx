import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

type Screen = 'welcome' | 'login' | 'register'

type Profile = {
  id: string
  username: string
  default_pet: string
}

const PETS = [
  {
    id: 'cat',
    name: 'Kedi',
    role: 'Okuma · Dil öğrenme · Tekrar',
    personality: 'Sakin ve sabırlı',
    description:
      'Sessiz çalışma seanslarını sever. Okurken, yeni bir dil öğrenirken veya öğrendiklerini tekrar ederken sana eşlik eder.',
  },
  {
    id: 'rooster',
    name: 'Horoz',
    role: 'Kodlama · Problem çözme · Analiz',
    personality: 'Meraklı ve dikkatli',
    description:
      'Zor problemleri kurcalamayı sever. Kodlama, teknik çalışmalar ve analiz gerektiren görevlerde yanında olur.',
  },
  {
    id: 'fish',
    name: 'Balık',
    role: 'Yazma · Tasarım · Üretim',
    personality: 'Yaratıcı ve rahat',
    description:
      'Fikirlerin akışına eşlik eder. Yazı yazarken, tasarım yaparken veya yeni bir şey üretirken sana alan açar.',
  },
]

function App() {
  const [screen, setScreen] = useState<Screen>('welcome')

  const [session, setSession] = useState<Session | null>(null)

  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const [username, setUsername] = useState('')
  const [selectedPet, setSelectedPet] = useState('')
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')

  useEffect(() => {
    const hash = new URLSearchParams(
      window.location.hash.slice(1)
    )

    const query = new URLSearchParams(
      window.location.search
    )

    if (hash.has('error') || query.has('error')) {
      setAuthError(
        'Google ile giriş tamamlanamadı. Lütfen tekrar dene.'
      )

      setScreen('login')

      window.history.replaceState(
        {},
        '',
        window.location.pathname
      )
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession)
        setAuthLoading(false)
        setAuthBusy(false)

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setProfileChecked(false)
          setUsername('')
          setSelectedPet('')
          setOnboardingError('')
          setScreen('welcome')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null)
      setProfileChecked(false)
      return
    }

    let cancelled = false

    async function loadProfile() {
      setProfileLoading(true)
      setProfileChecked(false)
      setOnboardingError('')

      const { data, error } = await supabase
        .from('profiles')
      .select('id, username, default_pet')
        .eq('id', session!.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error(error)

        setOnboardingError(
          'Profil bilgileri alınamadı. Lütfen sayfayı yenileyip tekrar dene.'
        )

        setProfile(null)
        setProfileLoading(false)
        setProfileChecked(true)

        return
      }

      setProfile(data)
      setProfileLoading(false)
      setProfileChecked(true)
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [session])

  async function handleGoogleLogin() {
    setAuthError('')
    setAuthBusy(true)

    try {
      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',

          options: {
            redirectTo: window.location.origin,
          },
        })

      if (error) {
        throw error
      }
    } catch {
      setAuthError(
        'Google girişi başlatılamadı. Lütfen tekrar dene.'
      )

      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    setAuthError('')
    setAuthBusy(true)

    try {
      const { error } = await supabase.auth.signOut({
        scope: 'local',
      })

      if (error) {
        throw error
      }
    } catch {
      setAuthError(
        'Çıkış yapılamadı. Lütfen tekrar dene.'
      )
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleCreateProfile(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!session) return

    setOnboardingError('')

    const cleanUsername = username.trim()

    const usernameRegex = /^[a-z0-9_]{3,20}$/

    if (!usernameRegex.test(cleanUsername)) {
      setOnboardingError(
        'Kullanıcı adı 3–20 karakter olmalı ve yalnızca küçük İngilizce harfler, rakamlar ve alt çizgi içermeli.'
      )

      return
    }

    if (!selectedPet) {
      setOnboardingError(
        'Devam etmek için bir yol arkadaşı seçmelisin.'
      )

      return
    }

    setOnboardingBusy(true)

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        username: cleanUsername,
        default_pet: selectedPet,
      })
      .select('id, username, default_pet')
      .single()

    if (error) {
      console.error(error)

      if (error.code === '23505') {
        setOnboardingError(
          'Bu kullanıcı adı başka bir yolcu tarafından alınmış. Başka bir kullanıcı adı deneyebilirsin.'
        )
      } else if (error.code === '23514') {
        setOnboardingError(
          'Kullanıcı adı kurallara uygun değil. Lütfen tekrar kontrol et.'
        )
      } else {
        setOnboardingError(
          'Profil oluşturulamadı. Lütfen tekrar dene.'
        )
      }

      setOnboardingBusy(false)
      return
    }

    setProfile(data)
    setOnboardingBusy(false)
  }

  if (authLoading) {
    return (
      <main className="auth-status" role="status">
        Oturum kontrol ediliyor…
      </main>
    )
  }

  /*
   * GİRİŞ YAPILDI
   * Önce profil kontrol edilir.
   */
  if (session) {
    if (profileLoading || !profileChecked) {
      return (
        <main className="auth-status" role="status">
          Yolcu bilgileri hazırlanıyor…
        </main>
      )
    }

    /*
     * İlk giriş:
     * profiles tablosunda kayıt yok.
     */
    if (!profile) {
      return (
        <div className="app">
          <header className="header">
            <div className="brand">
              FOCUS TRAIN
              <span>GÜNLÜK ODAK YOLCULUĞUN</span>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={handleSignOut}
              disabled={authBusy}
            >
              Çıkış yap
            </button>
          </header>

          <main className="onboarding-layout">
            <section className="onboarding-panel">
              <div className="station-label">
                YOLCU KAYDI · 01
              </div>

              <h1>
                Biletini hazırlayalım.
              </h1>

              <p className="intro">
                Yolculuğa başlamadan önce bir kullanıcı adı
                belirle ve sana eşlik edecek yol arkadaşını
                seç.
              </p>

              <form
                className="onboarding-form"
                onSubmit={handleCreateProfile}
              >
                <div className="form-group">
                  <label htmlFor="username">
                    Kullanıcı adı
                  </label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    minLength={3}
                    maxLength={20}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="yolcu-adı"
                    disabled={onboardingBusy}
                  />

                  <p className="field-help">
                    3–20 karakter · a–z · 0–9 · _
                  </p>
                </div>

                <fieldset
                  className="pet-fieldset"
                  disabled={onboardingBusy}
                >
                  <legend>
                    Yol arkadaşını seç
                  </legend>

                  <div className="pet-grid">
                    {PETS.map((pet) => {
                      const active =
                        selectedPet === pet.id

                      return (
                        <button
                          key={pet.id}
                          type="button"
                          className={
                            active
                              ? 'pet-card pet-card-selected'
                              : 'pet-card'
                          }
                          onClick={() =>
                            setSelectedPet(pet.id)
                          }
                          aria-pressed={active}
                        >
                          <div className="pet-placeholder">
                            PET
                          </div>

                       <div className="pet-card-content">
  <strong className="pet-name">
    {pet.name}
  </strong>

  <span className="pet-personality">
    {pet.personality}
  </span>

  <span className="pet-role">
    {pet.role}
  </span>

  <p className="pet-description">
    {pet.description}
  </p>
</div>

                          {active && (
                            <span className="pet-selected-label">
                              SEÇİLDİ
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {onboardingError && (
                  <p
                    className="auth-error"
                    role="alert"
                  >
                    {onboardingError}
                  </p>
                )}

            <button
  type="submit"
  className="primary-button"
  disabled={onboardingBusy || !username.trim() || !selectedPet}
>
  {onboardingBusy
    ? 'Bilet hazırlanıyor…'
    : 'Yolculuğa başla →'}
</button>
              </form>
            </section>
          </main>

          <footer className="footer">
            <span>YOLCU KAYDI</span>

            <span>
              İlk yolculuğundan önce.
            </span>
          </footer>
        </div>
      )
    }

    /*
     * Profil mevcut:
     * sonraki girişlerde onboarding gösterilmez.
     */
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            FOCUS TRAIN
            <span>GÜNLÜK ODAK YOLCULUĞUN</span>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={handleSignOut}
            disabled={authBusy}
          >
            {authBusy
              ? 'Çıkış yapılıyor…'
              : 'Çıkış yap'}
          </button>
        </header>

        <main className="auth-status">
          <div className="station-label">
            BUGÜNÜN ROTASI
          </div>

          <h1>
            Hoş geldin, @{profile.username}.
          </h1>

          <p>
            Yol arkadaşın hazır. Şimdi günlük plan ekranını
            buraya bağlayacağız.
          </p>

          <p>
            Seçilen pet:{' '}
            <strong>{profile.default_pet}</strong>
          </p>
        </main>

        <footer className="footer">
          <span>HER GÜN YENİ BİR ROTA.</span>
          <span>Bir seferle başla.</span>
        </footer>
      </div>
    )
  }

  /*
   * GİRİŞ YAPILMAMIŞ
   */
  const isRegister = screen === 'register'

  return (
    <div className="app">
      <header className="header">
        <button
          type="button"
          className="brand"
          onClick={() => setScreen('welcome')}
        >
          FOCUS TRAIN
          <span>GÜNLÜK ODAK YOLCULUĞUN</span>
        </button>

        <nav aria-label="Hesap">
          <button
            type="button"
            className="text-button"
            onClick={() => setScreen('login')}
          >
            Giriş yap
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={() => setScreen('register')}
          >
            Kayıt ol
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="content">
          {screen === 'welcome' ? (
            <>
              <div className="station-label">
                <span className="station-dot" />
                İLK DURAK · BUGÜN
              </div>

              <h1>
                Biraz odak.
                <br />
                <span>Yeni bir yolculuk.</span>
              </h1>

              <p className="intro">
                Bugün yapacaklarını bir tren rotasına
                dönüştür. Çalışma sürelerini belirle veya
                yapay zekâdan bir öneri al. Seferlerini
                tamamla, günün biletini koleksiyonuna ekle.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() => setScreen('register')}
              >
                Başla{' '}
                <span aria-hidden="true">
                  ↗
                </span>
              </button>

              <p className="account-note">
                Zaten hesabın var mı?{' '}
                <button
                  type="button"
                  className="inline-button"
                  onClick={() => setScreen('login')}
                >
                  Giriş yap
                </button>
              </p>

              <ol className="route">
                <li>Planını oluştur</li>
                <li>Yola çık</li>
                <li>Biletini biriktir</li>
              </ol>
            </>
          ) : (
            <div className="auth-panel">
              <button
                type="button"
                className="text-button back-button"
                onClick={() => setScreen('welcome')}
              >
                ← Ana sayfa
              </button>

              <div className="station-label">
                YOLCU İŞLEMLERİ
              </div>

              <h1>
                {isRegister
                  ? 'Yolculuğa katıl.'
                  : 'Tekrar hoş geldin.'}
              </h1>

              <p className="intro">
                {isRegister
                  ? 'Focus Train hesabını oluştur ve ilk yolculuğuna hazırlan.'
                  : 'Kaldığın yerden devam etmek için Google hesabınla giriş yap.'}
              </p>

              <button
                type="button"
                className="google-button"
                onClick={handleGoogleLogin}
                disabled={authBusy}
              >
                {authBusy
                  ? 'Google’a yönlendiriliyor…'
                  : 'Google ile devam et'}
              </button>

              <p className="auth-provider-note">
                Focus Train şu anda giriş ve kayıt işlemleri
                için yalnızca Google hesabını destekliyor.
                İlk kez devam ediyorsan hesabın otomatik
                olarak oluşturulur.
              </p>

              {authError && (
                <p
                  className="auth-error"
                  role="alert"
                >
                  {authError}
                </p>
              )}

              <p className="account-note">
                {isRegister
                  ? 'Zaten hesabın var mı? '
                  : 'Focus Train’de yeni misin? '}

                <button
                  type="button"
                  className="inline-button"
                  onClick={() =>
                    setScreen(
                      isRegister
                        ? 'login'
                        : 'register'
                    )
                  }
                >
                  {isRegister
                    ? 'Giriş yap'
                    : 'Kayıt ol'}
                </button>
              </p>
            </div>
          )}
        </section>

        <div className="artwork">
          <img
            src="/train.png"
            alt="Kâğıt üzerinde kıvrılarak ilerleyen kırmızı ve lacivert tren çizimi"
          />
        </div>
      </main>

      <footer className="footer">
        <span>HER GÜN YENİ BİR ROTA.</span>
        <span>Bir seferle başla.</span>
      </footer>
    </div>
  )
}

export default App