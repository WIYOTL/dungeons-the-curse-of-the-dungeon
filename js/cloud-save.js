(function () {
    let supabaseClientPromise = null;

    function setCloudStatus(message) {
        const status = document.getElementById('cloud-save-status');
        if (status) status.textContent = message;
    }

    function getCredentials() {
        const config = window.DUNGEONS_SUPABASE_CONFIG;
        if (!config || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url || '')
            || typeof config.anonKey !== 'string' || config.anonKey.length < 20) {
            throw new Error('Supabase n’est pas configuré. Renseignez l’URL du projet et sa clé anon publique dans js/supabase-config.js.');
        }
        return config;
    }

    async function getSupabaseClient() {
        const config = getCredentials();
        if (!supabaseClientPromise) {
            supabaseClientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
                .then(({ createClient }) => createClient(config.url, config.anonKey, {
                    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                }))
                .catch(error => {
                    supabaseClientPromise = null;
                    throw new Error(`Impossible de charger le client Supabase : ${error.message}`);
                });
        }
        return supabaseClientPromise;
    }

    function credentialsFromForm() {
        const email = document.getElementById('cloud-email')?.value.trim();
        const password = document.getElementById('cloud-password')?.value;
        if (!email || !password) throw new Error('Saisissez votre e-mail et votre mot de passe.');
        return { email, password };
    }

    async function runCloudAction(action) {
        try {
            await action();
        } catch (error) {
            console.error('Échec de la sauvegarde cloud :', error);
            setCloudStatus(error.message || 'Échec de l’opération cloud.');
            showNotification(error.message || 'Échec de l’opération cloud.');
        }
    }

    window.cloudSignUp = () => runCloudAction(async () => {
        const { email, password } = credentialsFromForm();
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        const message = data.session
            ? `Compte créé et connecté : ${email}.`
            : `Compte créé pour ${email}. Vérifiez votre e-mail pour confirmer l’inscription.`;
        setCloudStatus(message);
        showNotification(message);
    });

    window.cloudSignIn = () => runCloudAction(async () => {
        const { email, password } = credentialsFromForm();
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setCloudStatus(`Connecté : ${data.user.email}. Choisissez explicitement l’envoi ou le chargement.`);
        showNotification('Connexion cloud réussie.');
    });

    window.cloudSignOut = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        setCloudStatus('Déconnecté. La sauvegarde locale reste disponible.');
        showNotification('Déconnexion cloud effectuée.');
    });

    window.cloudUploadSave = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Connectez-vous avant d’envoyer une sauvegarde.');
        const { error } = await client.from('player_saves').upsert({
            user_id: user.id,
            save_data: buildSaveData(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) throw error;
        setCloudStatus(`Sauvegarde locale envoyée pour ${user.email}.`);
        showNotification('Sauvegarde cloud mise à jour.');
    });

    window.cloudDownloadSave = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Connectez-vous avant de charger une sauvegarde.');
        const { data, error } = await client.from('player_saves')
            .select('save_data, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Aucune sauvegarde cloud trouvée pour ce compte.');
        const save = data.save_data;
        if (!save || typeof save !== 'object' || Array.isArray(save)) {
            throw new Error('La sauvegarde cloud a un format invalide ; la progression locale est conservée.');
        }
        save.hasSavedProgress = true;
        if (!validateImportedSave(save)) {
            throw new Error('La sauvegarde cloud est invalide pour cette version du jeu ; la progression locale est conservée.');
        }
        let previousSave;
        try {
            previousSave = localStorage.getItem('dungeonsSave');
        } catch (error) {
            throw new Error(`Impossible de protéger la sauvegarde locale avant le remplacement : ${error.message}`);
        }
        if (!writeSaveData(save)) throw new Error('Impossible d’écrire la sauvegarde cloud dans le stockage local.');
        try {
            if (!loadGameSave()) throw new Error('La sauvegarde cloud n’a pas pu être activée.');
            if (!saveGame(true)) throw new Error('La sauvegarde chargée n’a pas pu être confirmée localement.');
        } catch (error) {
            try {
                if (previousSave === null) {
                    resetGameData();
                } else {
                    localStorage.setItem('dungeonsSave', previousSave);
                    if (!loadGameSave()) throw new Error('La sauvegarde locale restaurée ne peut pas être rechargée.');
                    renderOwnedSkins();
                    renderPhase3();
                }
            } catch (restoreError) {
                console.error('Échec de restauration de la sauvegarde locale :', restoreError);
                throw new Error(`Le chargement cloud a échoué et la sauvegarde locale n’a pas pu être restaurée : ${restoreError.message}`);
            }
            throw error;
        }
        renderOwnedSkins();
        renderPhase3();
        const message = `Sauvegarde cloud chargée (${new Date(data.updated_at).toLocaleString()}). La progression locale a été remplacée.`;
        setCloudStatus(message);
        showNotification('Sauvegarde cloud chargée.');
    });
})();
