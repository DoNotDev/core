/**
 * @fileoverview Public readers: the providers whose records the build and the server list
 * @description One table for every place that reads published records as a signed-out
 * visitor: the Vite build (`vite/buildPages.js`, record pages, sitemap.xml, llms.txt,
 * in-process) and the Next generated files (`BaseNextHandler.serverCrudReader`: sitemap
 * and llms.txt routes, entity pages, as code text). Each entry: the app dependency that
 * selects it, the module of its public reader, the public env variables it reads (without
 * the platform prefix: `VITE_` on Vite, `NEXT_PUBLIC_` on Next; never a privileged key,
 * RLS / Security Rules decide) and how to create it. In this order: the first provider the
 * app depends on is its reader. Each reader (`SupabasePublicReader`, `FirestorePublicReader`)
 * returns the records as the database returns them to a signed-out visitor, keyed by the
 * entity's field names (the read schema the readers pass), unfiltered.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

/**
 * @typedef {Object} PublicReaderProvider
 * @property {string} dependency - App dependency that selects it
 * @property {string} module - Module exporting the public reader
 * @property {readonly string[]} env - Public env variable names, without platform prefix
 * @property {(provider: Object, values: string[]) => import('@donotdev/core/server').ICrudAdapter} create - The reader from the module's exports and the env values
 */

/** @type {readonly PublicReaderProvider[]} */
export const PUBLIC_READERS = Object.freeze([
  {
    dependency: '@donotdev/supabase',
    module: '@donotdev/supabase/server',
    env: ['SUPABASE_URL', 'SUPABASE_PUBLIC_KEY'],
    create: (provider, [url, publicKey]) =>
      new provider.SupabasePublicReader(
        provider.createPublicServerClient(url, publicKey)
      ),
  },
  {
    dependency: '@donotdev/firebase',
    module: '@donotdev/firebase/public',
    env: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'],
    create: (provider, [apiKey, projectId]) =>
      new provider.FirestorePublicReader(
        provider.createPublicServerFirestore({ apiKey, projectId })
      ),
  },
]);

/**
 * The app's public reader provider: the first of {@link PUBLIC_READERS} it depends on.
 *
 * @param {(dependency: string) => boolean} dependsOn - Whether the app depends on a package
 * @returns {PublicReaderProvider | undefined}
 * @since 0.3.2
 */
export function publicReaderProvider(dependsOn) {
  return PUBLIC_READERS.find(({ dependency }) => dependsOn(dependency));
}

/** The supported providers, for the errors: `@donotdev/supabase, @donotdev/firebase`. */
export const PUBLIC_READER_DEPENDENCIES = PUBLIC_READERS.map(({ dependency }) => dependency).join(', ');
