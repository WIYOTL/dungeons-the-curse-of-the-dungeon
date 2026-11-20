(function () {
    let supabaseClientPromise = null;

    function setCloudStatus(message) {
        const status = document.getElementById('cloud-save-status');
        if (status) status.textContent = window.t(message);
    }

    function getCredentials() {
        const config = window.DUNGEONS_SUPABASE_CONFIG;
        if (!config || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url || '')
            || typeof config.anonKey !== 'string' || config.anonKey.length < 20) {
            throw new Error(window.t('Supabase n’est pas configuré. Renseignez l’URL du projet et sa clé anon publique dans js/supabase-config.js.'));
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
                    throw new Error(window.t('Impossible de charger le client Supabase : ') + error.message);
                });
        }
        return supabaseClientPromise;
    }

    function credentialsFromForm() {
        const email = document.getElementById('cloud-email')?.value.trim();
        const password = document.getElementById('cloud-password')?.value;
        if (!email || !password) throw new Error(window.t('Saisissez votre e-mail et votre mot de passe.'));
        return { email, password };
    }

    async function runCloudAction(action) {
        try {
            await action();
        } catch (error) {
            console.error(window.t('Échec de la sauvegarde cloud :'), error);
            setCloudStatus(error.message || window.t('Échec de l’opération cloud.'));
            showNotification(error.message || window.t('Échec de l’opération cloud.'));
        }
    }

    window.cloudSignUp = () => runCloudAction(async () => {
        const { email, password } = credentialsFromForm();
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        const message = data.session
            ? window.t('Compte créé et connecté : ') + email + window.t('.')
            : window.t('Compte créé pour ') + email + window.t('. Vérifiez votre e-mail pour confirmer l\'inscription.');
        setCloudStatus(message);
        showNotification(data.session
            ? window.t('Compte créé et connecté : ') + email + window.t('.')
            : window.t('Compte créé pour ') + email + window.t('. Vérifiez votre e-mail pour confirmer l\'inscription.'));
    });

    window.cloudSignIn = () => runCloudAction(async () => {
        const { email, password } = credentialsFromForm();
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setCloudStatus(window.t('Connecté : ') + data.user.email + window.t('. Choisissez explicitement l’envoi ou le chargement.'));
        showNotification(window.t('Connexion cloud réussie.'));
    });

    window.cloudSignOut = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        setCloudStatus(window.t('Déconnecté. La sauvegarde locale reste disponible.'));
        showNotification(window.t('Déconnexion cloud effectuée.'));
    });

    window.cloudUploadSave = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error(window.t('Connectez-vous avant d’envoyer une sauvegarde.'));
        const { error } = await client.from('player_saves').upsert({
            user_id: user.id,
            save_data: buildSaveData(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) throw error;
        setCloudStatus(window.t('Sauvegarde locale envoyée pour ') + user.email + window.t('.'));
        showNotification(window.t('Sauvegarde cloud mise à jour.'));
    });

    window.cloudDownloadSave = () => runCloudAction(async () => {
        const client = await getSupabaseClient();
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error(window.t('Connectez-vous avant de charger une sauvegarde.'));
        const { data, error } = await client.from('player_saves')
            .select('save_data, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(window.t('Aucune sauvegarde cloud trouvée pour ce compte.'));
        const save = data.save_data;
        if (!save || typeof save !== 'object' || Array.isArray(save)) {
            throw new Error(window.t('La sauvegarde cloud a un format invalide ; la progression locale est conservée.'));
        }
        save.hasSavedProgress = true;
        if (!validateImportedSave(save)) {
            throw new Error(window.t('La sauvegarde cloud est invalide pour cette version du jeu ; la progression locale est conservée.'));
        }
        let previousSave;
        try {
            previousSave = localStorage.getItem('dungeonsSave');
        } catch (error) {
            throw new Error(window.t('Impossible de protéger la sauvegarde locale avant le remplacement : ') + error.message);
        }
        if (!writeSaveData(save)) throw new Error(window.t('Impossible d’écrire la sauvegarde cloud dans le stockage local.'));
        try {
            if (!loadGameSave()) throw new Error(window.t('La sauvegarde cloud n’a pas pu être activée.'));
            if (!saveGame(true)) throw new Error(window.t('La sauvegarde chargée n’a pas pu être confirmée localement.'));
        } catch (error) {
            try {
                if (previousSave === null) {
                    resetGameData();
                } else {
                    localStorage.setItem('dungeonsSave', previousSave);
                    if (!loadGameSave()) throw new Error(window.t('La sauvegarde locale restaurée ne peut pas être rechargée.'));
                    renderOwnedSkins();
                    renderPhase3();
                }
            } catch (restoreError) {
                console.error(window.t('Échec de restauration de la sauvegarde locale :'), restoreError);
                throw new Error(window.t('Le chargement cloud a échoué et la sauvegarde locale n’a pas pu être restaurée : ') + restoreError.message);
            }
            throw error;
        }
        renderOwnedSkins();
        renderPhase3();
        const message = window.t('Sauvegarde cloud chargée') + ' (' + new Date(data.updated_at).toLocaleString() + '). ' + window.t('La progression locale a été remplacée.');
        setCloudStatus(message);
        showNotification(window.t('Sauvegarde cloud chargée.'));
    });
})();
