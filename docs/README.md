# NFL Monte Carlo — public forecast website

This folder is a self-contained, dependency-free HTML/CSS/JavaScript website.
Its data source is strictly `data/index.json` and `data/games/*.json`.
When verified new game forecasts are generated, the private simulator exports
**only allowlisted QB/RB/WR/TE/K results**. No source code, raw PBP,
injury feeds, private credentials, calibration sources, or sportsbook details
are exposed by the website data feed.

The feed initially contains no games. The website deliberately shows an honest
empty state instead of simulated examples.

## Publish with GitHub Pages

**Important:** The source `nfl-monte-carlo` repository is currently private.
GitHub Pages on a private repository requires a GitHub Pro/Team/Enterprise
plan. Do **not** make the entire simulator repository public just to enable
Pages. Instead, upgrade GitHub if desired, or create a separate public
**website-only** repository and copy this `docs/` folder without any
simulation files.

When eligible:
1. In repository Settings → Pages, select **Deploy from a branch**.
2. Choose branch **main**, folder **/docs**, and Save.
3. The expected standard project path, **after GitHub confirms deployment**,
   is https://ojan11-11.github.io/nfl-monte-carlo/ .
4. The website is public even if its source repository is private.

**Automation caveat:** GitHub's default `GITHUB_TOKEN` pushes do not
trigger Pages builds configured to deploy from a branch. Enable the included
independent `publish_website.yml` GitHub Actions workflow and its
`ENABLE_PUBLIC_SITE` repository variable as documented in
`evaluation/WEBSITE_SETUP.md` for automated deployments after each
forecast. The site is not live until Pages is enabled and a deploy succeeds.

## Content

- V9 baseline and clearly marked V10, V10+FG experiments
- Matchup selector and mobile-friendly QB/RB/WR/TE/K tables
- Mean stats and 10th–90th percentile ranges for yardage
- Pre-kickoff source-freeze timestamp and archived-game labels
- No invented projections, fantasy scoring, or betting recommendations
