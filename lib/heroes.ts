// Lista estática dos heróis do Dota 2.
// O valor salvo nos registros é o nome interno (ex.: "antimage").
// As imagens ficam em /images/heroes/<interno>.png.
export interface HeroInfo {
  interno: string;
  nome: string;
}

export const HEROES: HeroInfo[] = [
  { interno: 'antimage', nome: 'Anti-Mage' },
  { interno: 'axe', nome: 'Axe' },
  { interno: 'bane', nome: 'Bane' },
  { interno: 'bloodseeker', nome: 'Bloodseeker' },
  { interno: 'crystal_maiden', nome: 'Crystal Maiden' },
  { interno: 'drow_ranger', nome: 'Drow Ranger' },
  { interno: 'earthshaker', nome: 'Earthshaker' },
  { interno: 'juggernaut', nome: 'Juggernaut' },
  { interno: 'mirana', nome: 'Mirana' },
  { interno: 'morphling', nome: 'Morphling' },
  { interno: 'nevermore', nome: 'Shadow Fiend' },
  { interno: 'phantom_lancer', nome: 'Phantom Lancer' },
  { interno: 'puck', nome: 'Puck' },
  { interno: 'pudge', nome: 'Pudge' },
  { interno: 'razor', nome: 'Razor' },
  { interno: 'sand_king', nome: 'Sand King' },
  { interno: 'storm_spirit', nome: 'Storm Spirit' },
  { interno: 'sven', nome: 'Sven' },
  { interno: 'tiny', nome: 'Tiny' },
  { interno: 'vengefulspirit', nome: 'Vengeful Spirit' },
  { interno: 'windrunner', nome: 'Windranger' },
  { interno: 'zuus', nome: 'Zeus' },
  { interno: 'kunkka', nome: 'Kunkka' },
  { interno: 'lina', nome: 'Lina' },
  { interno: 'lion', nome: 'Lion' },
  { interno: 'shadow_shaman', nome: 'Shadow Shaman' },
  { interno: 'slardar', nome: 'Slardar' },
  { interno: 'tidehunter', nome: 'Tidehunter' },
  { interno: 'witch_doctor', nome: 'Witch Doctor' },
  { interno: 'lich', nome: 'Lich' },
  { interno: 'riki', nome: 'Riki' },
  { interno: 'enigma', nome: 'Enigma' },
  { interno: 'tinker', nome: 'Tinker' },
  { interno: 'sniper', nome: 'Sniper' },
  { interno: 'necrolyte', nome: 'Necrophos' },
  { interno: 'warlock', nome: 'Warlock' },
  { interno: 'beastmaster', nome: 'Beastmaster' },
  { interno: 'queenofpain', nome: 'Queen of Pain' },
  { interno: 'venomancer', nome: 'Venomancer' },
  { interno: 'faceless_void', nome: 'Faceless Void' },
  { interno: 'skeleton_king', nome: 'Wraith King' },
  { interno: 'death_prophet', nome: 'Death Prophet' },
  { interno: 'phantom_assassin', nome: 'Phantom Assassin' },
  { interno: 'pugna', nome: 'Pugna' },
  { interno: 'templar_assassin', nome: 'Templar Assassin' },
  { interno: 'viper', nome: 'Viper' },
  { interno: 'luna', nome: 'Luna' },
  { interno: 'dragon_knight', nome: 'Dragon Knight' },
  { interno: 'dazzle', nome: 'Dazzle' },
  { interno: 'rattletrap', nome: 'Clockwerk' },
  { interno: 'leshrac', nome: 'Leshrac' },
  { interno: 'furion', nome: "Nature's Prophet" },
  { interno: 'life_stealer', nome: 'Lifestealer' },
  { interno: 'dark_seer', nome: 'Dark Seer' },
  { interno: 'clinkz', nome: 'Clinkz' },
  { interno: 'omniknight', nome: 'Omniknight' },
  { interno: 'enchantress', nome: 'Enchantress' },
  { interno: 'huskar', nome: 'Huskar' },
  { interno: 'night_stalker', nome: 'Night Stalker' },
  { interno: 'broodmother', nome: 'Broodmother' },
  { interno: 'bounty_hunter', nome: 'Bounty Hunter' },
  { interno: 'weaver', nome: 'Weaver' },
  { interno: 'jakiro', nome: 'Jakiro' },
  { interno: 'batrider', nome: 'Batrider' },
  { interno: 'chen', nome: 'Chen' },
  { interno: 'spectre', nome: 'Spectre' },
  { interno: 'ancient_apparition', nome: 'Ancient Apparition' },
  { interno: 'doom_bringer', nome: 'Doom' },
  { interno: 'ursa', nome: 'Ursa' },
  { interno: 'spirit_breaker', nome: 'Spirit Breaker' },
  { interno: 'gyrocopter', nome: 'Gyrocopter' },
  { interno: 'alchemist', nome: 'Alchemist' },
  { interno: 'invoker', nome: 'Invoker' },
  { interno: 'silencer', nome: 'Silencer' },
  { interno: 'obsidian_destroyer', nome: 'Outworld Destroyer' },
  { interno: 'lycan', nome: 'Lycan' },
  { interno: 'brewmaster', nome: 'Brewmaster' },
  { interno: 'shadow_demon', nome: 'Shadow Demon' },
  { interno: 'lone_druid', nome: 'Lone Druid' },
  { interno: 'chaos_knight', nome: 'Chaos Knight' },
  { interno: 'meepo', nome: 'Meepo' },
  { interno: 'treant', nome: 'Treant Protector' },
  { interno: 'ogre_magi', nome: 'Ogre Magi' },
  { interno: 'undying', nome: 'Undying' },
  { interno: 'rubick', nome: 'Rubick' },
  { interno: 'disruptor', nome: 'Disruptor' },
  { interno: 'nyx_assassin', nome: 'Nyx Assassin' },
  { interno: 'naga_siren', nome: 'Naga Siren' },
  { interno: 'keeper_of_the_light', nome: 'Keeper of the Light' },
  { interno: 'wisp', nome: 'Io' },
  { interno: 'visage', nome: 'Visage' },
  { interno: 'slark', nome: 'Slark' },
  { interno: 'medusa', nome: 'Medusa' },
  { interno: 'troll_warlord', nome: 'Troll Warlord' },
  { interno: 'centaur', nome: 'Centaur Warrunner' },
  { interno: 'magnataur', nome: 'Magnus' },
  { interno: 'shredder', nome: 'Timbersaw' },
  { interno: 'bristleback', nome: 'Bristleback' },
  { interno: 'tusk', nome: 'Tusk' },
  { interno: 'skywrath_mage', nome: 'Skywrath Mage' },
  { interno: 'abaddon', nome: 'Abaddon' },
  { interno: 'elder_titan', nome: 'Elder Titan' },
  { interno: 'legion_commander', nome: 'Legion Commander' },
  { interno: 'techies', nome: 'Techies' },
  { interno: 'ember_spirit', nome: 'Ember Spirit' },
  { interno: 'earth_spirit', nome: 'Earth Spirit' },
  { interno: 'abyssal_underlord', nome: 'Underlord' },
  { interno: 'terrorblade', nome: 'Terrorblade' },
  { interno: 'phoenix', nome: 'Phoenix' },
  { interno: 'oracle', nome: 'Oracle' },
  { interno: 'winter_wyvern', nome: 'Winter Wyvern' },
  { interno: 'arc_warden', nome: 'Arc Warden' },
  { interno: 'monkey_king', nome: 'Monkey King' },
  { interno: 'dark_willow', nome: 'Dark Willow' },
  { interno: 'pangolier', nome: 'Pangolier' },
  { interno: 'grimstroke', nome: 'Grimstroke' },
  { interno: 'hoodwink', nome: 'Hoodwink' },
  { interno: 'void_spirit', nome: 'Void Spirit' },
  { interno: 'snapfire', nome: 'Snapfire' },
  { interno: 'mars', nome: 'Mars' },
  { interno: 'ringmaster', nome: 'Ringmaster' },
  { interno: 'dawnbreaker', nome: 'Dawnbreaker' },
  { interno: 'marci', nome: 'Marci' },
  { interno: 'primal_beast', nome: 'Primal Beast' },
  { interno: 'muerta', nome: 'Muerta' },
  { interno: 'kez', nome: 'Kez' },
  { interno: 'largo', nome: 'Largo' },
].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

// Compara ignorando maiúsculas, acentos, espaços, hífens e apóstrofos.
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^npc_dota_hero_/, '')
    .replace(/[\s'_-]+/g, '');
}

const POR_CHAVE = new Map<string, HeroInfo>();
for (const hero of HEROES) {
  POR_CHAVE.set(normalizar(hero.interno), hero);
  POR_CHAVE.set(normalizar(hero.nome), hero);
}

export function acharHero(valor: string | null | undefined): HeroInfo | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  return POR_CHAVE.get(normalizar(texto)) ?? null;
}

// Nome de exibição do herói (mantém o valor original quando não reconhecido).
export function nomeHeroi(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  return acharHero(texto)?.nome ?? texto;
}

// Nome interno usado pelas imagens e pelos registros.
export function internoHeroi(valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  return acharHero(texto)?.interno ?? texto;
}
