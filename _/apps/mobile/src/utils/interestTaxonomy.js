const normalize = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, " ");
};

// Canonical, user-facing interest taxonomy.
// - label: what the user sees
// - value: what we store in the DB (lowercase)
export const INTEREST_TAXONOMY = [
  {
    category: "Arts & Culture",
    items: [
      "Museum & Gallery Visits",
      "Painting / Drawing",
      "Photography (Studio, Street)",
      "Poetry & Spoken Word",
      "Sculpture",
      "Theater / Plays",
    ],
  },
  {
    category: "Entertainment & Games",
    items: [
      "Board Games",
      "Escape Rooms",
      "Movies & Film Festivals",
      "Trivia Nights",
      "Video Games / eSports",
    ],
  },
  {
    category: "Fitness & Wellness",
    items: [
      "Dance Classes",
      "Gym Workouts",
      "Martial Arts",
      "Meditation / Mindfulness",
      "Yoga / Pilates",
    ],
  },
  {
    category: "Food & Drink",
    items: [
      "Baking",
      "Cooking Classes",
      "Craft Beer",
      "Food Trucks",
      "Restaurant Hopping",
      "Sushi",
      "Wine Tasting",
    ],
  },
  {
    category: "Learning & Workshops",
    items: [
      "Career Networking",
      "Coding Meetups",
      "DIY & Crafts",
      "Language Exchange",
      "Photography Workshops",
    ],
  },
  {
    category: "Music & Nightlife",
    items: [
      "Bar Hopping",
      "DJ / Dance Nights",
      "Jazz / Blues Shows",
      "Karaoke",
      "Live Concerts",
      "Open Mic",
      "Sports Bar",
    ],
  },
  {
    category: "Outdoors & Adventure",
    items: [
      "Beach Day",
      "Boating",
      "Camping",
      "Fishing",
      "Hiking / Backpacking",
      "Kayaking / Paddleboarding",
      "Road Trips",
      "Rock Climbing",
    ],
  },
  {
    category: "Pets & Animals",
    items: [
      "Animal-Shelter Volunteering",
      "Cat Cafés",
      "Dog Walking & Park Meetups",
    ],
  },
  {
    category: "Shopping & Markets",
    items: [
      "Farmer’s Markets",
      "Flea Markets",
      "Mall Trips",
      "Pop-up Shops",
      "Thrift Stores",
    ],
  },
  {
    category: "Sports",
    items: [
      "Basketball",
      "Bowling",
      "Cycling",
      "Darts",
      "Gaming Console",
      "Golf",
      "Other Sports",
      "Pickleball",
      "Pool",
      "Racquetball",
      "Running",
      "Soccer",
      "Swimming",
      "Table Tennis",
      "Tennis",
      "Volleyball",
    ],
  },
  {
    category: "Volunteering & Causes",
    items: ["Charity Runs", "Community Clean-ups", "Food-Bank Shifts"],
  },
  {
    category: "Other / Custom",
    items: [],
  },
].map((c) => ({
  category: c.category,
  items: [...c.items].sort((a, b) => a.localeCompare(b)),
}));

// New: grouped sections used by the UI to keep interest picking skimmable.
// We keep the underlying taxonomy the same; we only change how it is presented.
export const INTEREST_GROUPS = [
  {
    id: "gaming",
    label: "🎮 Gaming",
    categories: ["Entertainment & Games"],
    includeValues: ["gaming console"],
  },
  {
    id: "music",
    label: "🎵 Music & Nightlife",
    categories: ["Music & Nightlife"],
  },
  {
    id: "food",
    label: "🍽 Food & Drink",
    categories: ["Food & Drink"],
  },
  {
    id: "outdoors",
    label: "🏞 Outdoors",
    categories: ["Outdoors & Adventure"],
  },
  {
    id: "sports",
    label: "🏀 Sports",
    categories: ["Sports"],
    excludeValues: ["gaming console"],
  },
  {
    id: "leisure",
    label: "📚 Leisure",
    categories: [
      "Arts & Culture",
      "Fitness & Wellness",
      "Learning & Workshops",
      "Pets & Animals",
      "Shopping & Markets",
      "Volunteering & Causes",
    ],
  },
];

export function getTaxonomyItems() {
  const out = [];
  for (const cat of INTEREST_TAXONOMY) {
    for (const label of cat.items) {
      out.push({
        category: cat.category,
        label,
        value: normalize(label),
      });
    }
  }
  return out;
}

export function getGroupedTaxonomyItems() {
  const items = getTaxonomyItems();
  const byCategory = new Map();
  for (const it of items) {
    const list = byCategory.get(it.category) || [];
    list.push(it);
    byCategory.set(it.category, list);
  }

  const out = [];
  for (const group of INTEREST_GROUPS) {
    const groupItems = [];

    for (const cat of group.categories || []) {
      const list = byCategory.get(cat) || [];
      groupItems.push(...list);
    }

    if (Array.isArray(group.includeValues) && group.includeValues.length) {
      const includeSet = new Set(group.includeValues.map(normalize));
      const included = items.filter((it) => includeSet.has(it.value));
      groupItems.push(...included);
    }

    let unique = groupItems;
    // Deduplicate by value
    const seen = new Set();
    unique = unique.filter((it) => {
      if (!it?.value) {
        return false;
      }
      if (seen.has(it.value)) {
        return false;
      }
      seen.add(it.value);
      return true;
    });

    if (Array.isArray(group.excludeValues) && group.excludeValues.length) {
      const exclude = new Set(group.excludeValues.map(normalize));
      unique = unique.filter((it) => !exclude.has(it.value));
    }

    unique.sort((a, b) => a.label.localeCompare(b.label));

    out.push({
      id: group.id,
      label: group.label,
      items: unique,
    });
  }

  return out;
}

export function getInterestLabel(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return "";
  }

  const all = getTaxonomyItems();
  const found = all.find((x) => x.value === normalized);
  return found?.label || value;
}

export function normalizeInterest(value) {
  return normalize(value);
}

// NEW: helpers to map an interest value to a category / group (used for map pin icons).
export function getInterestCategory(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return "";
  }

  const all = getTaxonomyItems();
  const found = all.find((x) => x.value === normalized);
  return found?.category || "";
}

// NEW: category ids used for map pin art/icons.
export const INTEREST_CATEGORY_IDS = {
  "Arts & Culture": "arts",
  "Entertainment & Games": "games",
  "Fitness & Wellness": "fitness",
  "Food & Drink": "food",
  "Learning & Workshops": "learning",
  "Music & Nightlife": "music",
  "Outdoors & Adventure": "outdoors",
  "Pets & Animals": "pets",
  "Shopping & Markets": "shopping",
  Sports: "sports",
  "Volunteering & Causes": "volunteering",
  "Other / Custom": "other",
};

export function getInterestCategoryIdForValue(value) {
  const normalized = normalize(value);

  // Small overrides for edge cases where the raw taxonomy category is confusing for icons.
  if (normalized === "gaming console") {
    return "games";
  }
  if (normalized === "sports bar") {
    return "sports";
  }

  const category = getInterestCategory(value);
  const key = INTEREST_CATEGORY_IDS[category];
  return key || "other";
}

export function getInterestGroupForValue(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  // Explicit includeValues mapping takes priority.
  for (const g of INTEREST_GROUPS) {
    if (Array.isArray(g.includeValues) && g.includeValues.length) {
      const includes = new Set(g.includeValues.map(normalize));
      if (includes.has(normalized)) {
        return { id: g.id, label: g.label };
      }
    }
  }

  const category = getInterestCategory(normalized);
  if (!category) {
    return null;
  }

  const group = INTEREST_GROUPS.find((g) =>
    (g.categories || []).includes(category),
  );
  if (!group) {
    return null;
  }

  return { id: group.id, label: group.label };
}
