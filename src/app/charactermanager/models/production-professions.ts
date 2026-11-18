import type { ProfessionDefinition } from './profession';

/** Eligible recipe examples by skill tier, not an automatically learned recipe list. */
export const PRODUCTION_PROFESSIONS: ProfessionDefinition[] = [
  {
    key: 'alchemy', name: 'Alchemy', initials: 'Al', category: 'production',
    requirement: "Alchemist's Supplies or Herbalism Kit proficiency",
    tools: ["Alchemist's Supplies", 'Herbalism Kit'],
    summary: 'Turn herbs into potions, useful equipment, magical dusts, and perfumes.',
    rules: ['Alchemy primarily uses herbalism resources, either gathered or purchased.'],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: ['Acid', "Alchemist's Fire", 'Component Pouch', 'Fuel', 'Oil', 'Paper', 'Perfume', 'Common Potions', 'Perfume of Bewitching'] },
      { bonus: 3, name: 'Journeyman', items: ['Uncommon Potions', 'Alchemy Jug', 'Dust of Disappearance', 'Dust of Dryness', "Keoghtom's Ointment"] },
      { bonus: 4, name: 'Expert', items: ['Rare Potions'] },
      { bonus: 5, name: 'Artisan', items: ['Very Rare Potions', "Philosopher's Stone"] },
      { bonus: 6, name: 'Master', items: ['Legendary Potions', 'Sovereign Glue', 'Universal Solvent'] },
    ],
  },
  {
    key: 'blacksmithing', name: 'Blacksmithing', initials: 'Bl', category: 'production',
    requirement: "Mason's Tools or Smith's Tools proficiency",
    tools: ["Mason's Tools", "Smith's Tools"],
    summary: 'Forge metal and stone into weapons, armor, and other durable equipment.',
    rules: [
      'Blacksmithing primarily uses metal and stone from mining. Some recipes also require cloth or leather.',
      'Weapon and armor recipe categories cover melee weapons except Club, Greatclub, Quarterstaff, and Whip; medium armor except Hide; heavy armor; and Shields. Magic ammunition and the listed weapon and armor categories follow the rarity for their recipe tier.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: [
        'Any Melee weapon except Club, Greatclub, Quarterstaff, Whip', 'Medium armor except Hide', 'Heavy armor', 'Shield',
        'Ball Bearings', 'Block and Tackle', 'Bucket', 'Caltrops', 'Chain', 'Crowbar', 'Firearm Bullets', 'Grappling Hook',
        'Iron Pot', 'Iron Spikes', 'Sling Bullets', 'Common magic ammunition, Armor, Weapons in those categories', 'Dark Shard Amulet', 'Dread Helm',
      ] },
      { bonus: 3, name: 'Journeyman', items: [
        'Uncommon magic ammunition, Armor, Weapons in those categories', 'Figurine of Wondrous Power (silver raven)',
        'Gauntlets of Ogre Power', 'Helm of Comprehending Languages', 'Helm of Telepathy', 'Sending Stones', 'Stone of Good Luck (Luckstone)',
      ] },
      { bonus: 4, name: 'Expert', items: [
        'Rare magic ammunition, Armor, Weapons in those categories', 'Belt of Giant Strength (hill)', 'Bracers of Defense',
        'Brazier of Commanding Fire Elementals', 'Dimensional Shackles', 'Figurine of Wondrous Power (bronze griffon, golden lions, marble elephant)',
        'Helm of Teleportation', 'Horseshoes of Speed', 'Iron Bands of Bilarro', 'Stone of Controlling Earth Elementals',
      ] },
      { bonus: 5, name: 'Artisan', items: [
        'Very Rare magic ammunition, Armor, Weapons in those categories', 'Belt of Giant Strength (fire, frost, or stone)', 'Helm of Brilliance', 'Horseshoes of a Zephyr',
      ] },
      { bonus: 6, name: 'Master', items: [
        'Legendary magic ammunition, Armor, Weapons in those categories', 'Belt of Giant Strength (cloud or storm)', 'Iron Flask',
      ] },
    ],
  },
  {
    key: 'cooking', name: 'Cooking', initials: 'Co', category: 'production',
    requirement: "Brewer's Supplies or Cook's Utensils proficiency",
    tools: ["Brewer's Supplies", "Cook's Utensils"],
    summary: 'Prepare nourishing food and drink from fishing, herbalism, and hunting ingredients.',
    rules: [
      'Cooking uses ingredients obtained through fishing, herbalism, or hunting.',
      'The Chef feat can reflect further culinary skill. A profession grant does not automatically grant the feat.',
      "At artisan skill (+5 Proficiency Bonus), spend 1 hour and 1,000 GP of resources to prepare a meal that duplicates Heroes' Feast. Fish and meat can supply those resources.",
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: ['Antitoxin', 'Rations', 'Bead of Nourishment', 'Bead of Refreshment', "Heward's Handy Spice Pouch", 'Tankard of Sobriety'] },
    ],
  },
  {
    key: 'enchanting', name: 'Enchanting', initials: 'En', category: 'production',
    requirement: "Carpenter's Tools, Potter's Tools, or Woodcarver's Tools proficiency",
    tools: ["Carpenter's Tools", "Potter's Tools", "Woodcarver's Tools"],
    summary: 'Shape wood and magical reagents into enchanted weapons, implements, and wondrous objects.',
    rules: [
      'Enchanting uses magical residue, herbs, and gems as reagents.',
      'Weapon categories cover wooden weapons (Club, Greatclub, Quarterstaff) and ranged weapons except Musket, Pistol, and Sling. Ammunition categories cover Arrows, Bolts, and Needles.',
      'Disenchant a permanent magic item over 1 hour, which can overlap a Short Rest. The item must not be attuned to someone else. Remove its magic and store the resulting residue as dust or a shard usable in any enchanting formula.',
      'Disenchanting Common items requires +3 Proficiency Bonus and yields 25 GP of residue.',
      'Disenchanting Uncommon items requires +4 Proficiency Bonus and yields 100 GP of residue.',
      'Disenchanting Rare items requires +5 Proficiency Bonus and yields 1,000 GP of residue.',
      'Disenchanting Very Rare items requires +6 Proficiency Bonus and yields 10,000 GP of residue.',
      'Legendary items and Artifacts cannot be disenchanted.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: [
        'Wooden weapons (Club, Greatclub, Quarterstaff)', 'Ranged weapons except Musket, Pistol, Sling', 'Ammunition (Arrows, Bolts, Needles)',
        'Arcane Focus', 'Barrel', 'Chest', 'Druidic Focus', 'Ink Pen', 'Jug', 'Ladder', 'Lamp', 'Pole', 'Portable Ram', 'Torch',
        'Common magic ammunition in those categories', 'Common Wands', "Charlatan's Die", 'Pot of Awakening',
      ] },
      { bonus: 3, name: 'Journeyman', items: [
        'Uncommon magic ammunition and Weapons in those categories', 'Uncommon Rods and Wands', 'Uncommon Enspelled Armor, Staff, Weapon',
        'Broom of Flying', 'Decanter of Endless Water', 'Pipes of Haunting', 'Pipes of the Sewers',
      ] },
      { bonus: 4, name: 'Expert', items: [
        'Rare magic ammunition and Weapons in those categories', 'Rare Rods and Wands', 'Rare Enspelled Armor, Staff, Weapon',
        'Bowl of Commanding Water Elementals', 'Figurine of Wondrous Power (ebony fly)',
      ] },
      { bonus: 5, name: 'Artisan', items: [
        'Very Rare magic ammunition and Weapons in those categories', 'Very Rare Rods and Wands', 'Very Rare Enspelled Armor, Staff, Weapon',
      ] },
      { bonus: 6, name: 'Master', items: [
        'Legendary magic ammunition and Weapons in those categories', 'Legendary Rods and Wands', 'Legendary Enspelled Armor, Staff, Weapon',
      ] },
    ],
  },
  {
    key: 'engineering', name: 'Engineering', initials: 'Eg', category: 'production',
    requirement: "Tinker's Tools proficiency", tools: ["Tinker's Tools"],
    summary: 'Build mechanical contraptions, firearms, vehicles, and explosive inventions.',
    rules: [
      'Engineering uses mining resources and sometimes leather or cloth, from intricate gnome contraptions to goblin explosives.',
      'Making components such as copper bolts or blasting powder is included in the finished item’s crafting time and cost.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: [
        'Musket', 'Pistol', 'Bell', 'Bullseye Lantern', 'Flask', 'Hooded Lantern', 'Hunting Trap', 'Lock', 'Manacles', 'Mirror', 'Shovel',
        'Signal Whistle', 'Tinderbox', 'Clockwork Amulet', 'Ear Horn of Hearing', 'Ersatz Eye', 'Horn of Silent Alarm', 'Instrument of Illusions',
        'Instrument of Scribing', 'Lock of Trickery', 'Mystery Key', 'Orb of Direction', 'Orb of Time', 'Pipe of Smoke Monsters', 'Pole of Angling',
        "Pole of Collapsing", 'Prosthetic Limb', 'Rival Coin', "Veteran's Cane",
      ] },
      { bonus: 3, name: 'Journeyman', items: [
        'Goblin Trike', 'Uncommon magic Muskets and Pistols', "Baba Yaga's Dancing Broom", 'Driftglobe', 'Eversmoking Bottle',
        'Goblin Jumper Cables', 'Goggles of Night', 'Lantern of Revealing', 'Wind Fan',
      ] },
      { bonus: 4, name: 'Expert', items: [
        'Flying Machine', 'Mechano-Hog', "Mekgineer's Chopper", 'Rare magic Muskets and Pistols', 'Chime of Opening', 'Cube of Summoning',
        "Daern's Instant Fortress", 'Experimental Goblin Jetpack', 'Horn of Blasting', 'Horn of Valhalla (brass or silver)', 'Portable Hole',
      ] },
      { bonus: 5, name: 'Artisan', items: ['Very Rare magic Muskets and Pistols', 'Cauldron of Rebirth', 'Horn of Valhalla (bronze)'] },
      { bonus: 6, name: 'Master', items: [
        'Legendary magic Muskets and Pistols', 'Apparatus of Kwalish', 'Cubic Gate', 'Horn of Valhalla (iron)', 'Sphere of Annihilation', 'Talisman of the Sphere', 'Well of Many Worlds',
      ] },
    ],
  },
  {
    key: 'inscription', name: 'Inscription', initials: 'In', category: 'production',
    requirement: "Calligrapher's Supplies, Cartographer's Tools, or Painter's Supplies proficiency",
    tools: ["Calligrapher's Supplies", "Cartographer's Tools", "Painter's Supplies"],
    summary: 'Create magical scrolls, staffs, symbols, and books with herbal pigments and inks.',
    rules: [
      'Inscription uses herbalism resources, gathered or purchased, for pigments and inks. Milling herbs into pigments and inks is included in the finished item’s crafting time and cost.',
      'Inscription Adept is a separately acquired optional feat, not an automatic profession reward. It requires level 4 or higher and proficiency in one of the inscription tools.',
      'Inscription Adept increases Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. The chosen ability is the spellcasting ability for the feat’s spells.',
      'With Inscription Adept, Illusory Script is always prepared. Cast it once without a spell slot per Long Rest, or with appropriate spell slots. Herbalism resources of the appropriate value can replace its Material component.',
      'Inscription Adept also teaches Glyph of Warding at profession Proficiency Bonus +3 and Symbol at +5. These spells are cast in the same way as the feat’s Illusory Script.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: ['Druidic Focus', 'Holy Symbol', 'Ink', 'Map', 'Common Scrolls and Staffs', 'Enduring Spellbook'] },
      { bonus: 3, name: 'Journeyman', items: ['Uncommon Scrolls and Staffs', 'Deck of Illusions'] },
      { bonus: 4, name: 'Expert', items: ['Rare Scrolls and Staffs'] },
      { bonus: 5, name: 'Artisan', items: [
        'Very Rare Scrolls and Staffs', 'Manual of Bodily Health', 'Manual of Gainful Exercise', 'Manual of Golems (any)', 'Manual of Quickness of Action',
        "Nolzur's Marvelous Pigments", 'Spirit Board', 'Tome of Clear Thought', 'Tome of Leadership and Influence', 'Tome of Understanding',
      ] },
      { bonus: 6, name: 'Master', items: ['Legendary Scrolls and Staffs', 'Tome of the Stilled Tongue'] },
    ],
  },
  {
    key: 'jewelcrafting', name: 'Jewelcrafting', initials: 'Je', category: 'production',
    requirement: "Glassblower's Tools or Jeweler's Tools proficiency",
    tools: ["Glassblower's Tools", "Jeweler's Tools"],
    summary: 'Work precious metals and gems into jewelry, lenses, and magical treasures.',
    rules: ['Jewelcrafting uses metals and gems obtained through mining or purchase.'],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: ['Arcane Focus', 'Glass Bottle', 'Holy Symbol', 'Magnifying Glass', 'Spyglass', 'Vial', 'Ruby of the War Mage'] },
      { bonus: 3, name: 'Journeyman', items: [
        'Uncommon magic Rings', 'Amulet of Proof against Detection and Location', 'Brooch of Shielding', 'Circlet of Blasting', 'Elemental Gem',
        'Eyes of Charming', 'Eyes of Minute Seeing', 'Gem of Brightness', 'Headband of Intellect', 'Medallion of Thoughts', 'Necklace of Adaptation',
        'Pearl of Power', 'Periapt of Health', 'Periapt of Wound Closure', "Uncommon Quaal's Feather Tokens",
      ] },
      { bonus: 4, name: 'Expert', items: [
        'Rare magic Rings', 'Amulet of Health', 'Bead of Force', 'Censer of Controlling Air Elementals', 'Cube of Force',
        'Rare Figurines of Wondrous Power (including jade panther)', 'Gem of Seeing', 'Rare Ioun Stones', 'Necklace of Fireballs',
        'Necklace of Prayer Beads', 'Periapt of Proof against Poison', "Rare Quaal's Feather Tokens",
      ] },
      { bonus: 5, name: 'Artisan', items: [
        'Very Rare magic Rings', 'Amulet of the Planes', 'Crystal Ball of Telepathy', 'Very Rare Figurines of Wondrous Power', 'Very Rare Ioun Stones', 'Mirror of Life Trapping',
      ] },
      { bonus: 6, name: 'Master', items: ['Legendary magic Rings', 'Crystal Ball of Mind Reading', 'Crystal Ball of True Seeing', 'Legendary Ioun Stones', 'Scarab of Protection'] },
    ],
  },
  {
    key: 'leatherworking', name: 'Leatherworking', initials: 'Le', category: 'production',
    requirement: "Cobbler's Tools or Leatherworker's Tools proficiency",
    tools: ["Cobbler's Tools", "Leatherworker's Tools"],
    summary: 'Turn gathered leather and hide into armor, equipment, and magical accessories.',
    rules: [
      'Leatherworking primarily uses resources gathered through skinning.',
      'Weapon and armor recipe categories cover Sling, Whip, Hide Armor, Leather Armor, and Studded Leather Armor.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: [
        'Sling', 'Whip', 'Hide Armor', 'Leather Armor', 'Studded Leather Armor', 'Backpack', "Climber's Kit", 'Crossbow Bolt Case',
        'Map or Scroll Case', 'Parchment', 'Pouch', 'Quiver', 'Waterskin', 'Common magic Armor and Weapons in those categories', 'Boots of False Tracks',
      ] },
      { bonus: 3, name: 'Journeyman', items: [
        'Uncommon magic Armor and Weapons in those categories', 'Boots of Elvenkind', 'Boots of Striding and Springing', 'Boots of the Winterlands',
        'Bracers of Archery', "Heward's Handy Haversack", 'Quiver of Ehlonna', 'Saddle of the Cavalier', 'Winged Boots',
      ] },
      { bonus: 4, name: 'Expert', items: ['Rare magic Armor and Weapons in those categories', 'Boots of Levitation', 'Boots of Speed'] },
      { bonus: 5, name: 'Artisan', items: ['Very Rare magic Armor and Weapons in those categories'] },
      { bonus: 6, name: 'Master', items: ['Legendary magic Armor and Weapons in those categories'] },
    ],
  },
  {
    key: 'tailoring', name: 'Tailoring', initials: 'Ta', category: 'production',
    requirement: "Weaver's Tools proficiency", tools: ["Weaver's Tools"],
    summary: 'Sew cloth into clothing, padded armor, bags, and magical garments.',
    rules: [
      'Tailoring uses cloth bolts purchased or found as treasure. Humanoids may carry cloth as trade goods.',
      'Cloth resources follow gathering resource values: linen is worth 10 GP, wool 25 GP, and the most valuable cloth reaches 7,500 GP. Dawnweave and duskweave are found only in Khaz Algar.',
    ],
    recipeTiers: [
      { bonus: 2, name: 'Apprentice', items: [
        'Padded Armor', 'Basket', 'Bedroll', 'Blanket', 'Fine Clothes', 'Net', 'Robe', 'Rope', 'Sack', 'String', 'Tent', "Traveler's Clothes",
        'Common magic Padded Armor', 'Cloak of Billowing', 'Cloak of Many Fashions', 'Clothes of Mending', 'Hat of Vermin', 'Hat of Wizardry', 'Rope of Mending', 'Talking Doll',
      ] },
      { bonus: 3, name: 'Journeyman', items: [
        'Uncommon magic Padded Armor', 'Bag of Holding', 'Bag of Tricks', 'Cap of Water Breathing', 'Cloak of Elvenkind', 'Cloak of Protection',
        'Cloak of the Manta Ray', 'Gloves of Missile Snaring', 'Gloves of Swimming and Climbing', 'Gloves of Thievery', 'Hat of Disguise',
        "Nature's Mantle", 'Robe of Useful Items', 'Rope of Climbing', 'Slippers of Spider Climbing', 'Wraps of Unarmed Power (+1)',
      ] },
      { bonus: 4, name: 'Expert', items: [
        'Rare magic Padded Armor', 'Bag of Beans', 'Cape of the Mountebank', 'Cloak of Displacement', 'Cloak of the Bat',
        'Mantle of Spell Resistance', 'Robe of Eyes', 'Rope of Entanglement', 'Wings of Flying', 'Wraps of Unarmed Power (+2)',
      ] },
      { bonus: 5, name: 'Artisan', items: [
        'Very Rare magic Padded Armor', 'Carpet of Flying', 'Cloak of Arachnida', 'Hat of Many Spells', 'Robe of Scintillating Colors', 'Robe of Stars', 'Wraps of Unarmed Power (+3)',
      ] },
      { bonus: 6, name: 'Master', items: ['Legendary magic Padded Armor', 'Cloak of Invisibility', 'Robe of the Archmagi'] },
    ],
  },
];
