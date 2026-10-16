import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";

// Every item below was opened in the owner's signed-in LinkedIn session. The profile
// name matched the Rolodex record before its photo URL was captured.
const photos = [
  [34, "Adam Goldberg", "https://www.linkedin.com/in/thatsmyhead/", "https://media.licdn.com/dms/image/v2/C5603AQG9-loQXkM_CQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1590965428286?e=1793836800&v=beta&t=VPcqHCmrOttd7aYbQ0xHFeHrGwPvjH_V0tzz5h6Jig4"],
  [35, "Adam Meyer", "https://www.linkedin.com/in/adam-meyer-27733617/", "https://media.licdn.com/dms/image/v2/D5603AQFGpCE4tiSfAQ/profile-displayphoto-crop_800_800/B56aCRiE81K0AI-/0/1789148025875?e=1793836800&v=beta&t=VdJErc2bMNc4H12-N6Dg_TDkGO4iFWMb4fehWR9JXnw"],
  [36, "Adrian Bubela", "https://www.linkedin.com/in/adrianbubela/", "https://media.licdn.com/dms/image/v2/D4D03AQG_sTnqJMb7og/profile-displayphoto-crop_800_800/B4DZsJi04IH0AI-/0/1765391683576?e=1793836800&v=beta&t=D-zzHzrPDZhTlo36i_fwGB6ZM1TP6ncJ1UHORUxgxwg"],
  [37, "Alan Urquhart", "https://www.linkedin.com/in/alanurquhart/", "https://media.licdn.com/dms/image/v2/D5603AQHKqhtI7KAuvQ/profile-displayphoto-shrink_800_800/B56ZbQrHiTHUAc-/0/1747257686492?e=1793836800&v=beta&t=AA_1QWxFN8KLQ4_-l0hq9N9d-Kz7N87L_pwL-kAfqpk"],
  [38, "Alen Bubich", "https://www.linkedin.com/in/bubich/", "https://media.licdn.com/dms/image/v2/D5603AQHZBjY4KOU1aA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1692459898042?e=1793836800&v=beta&t=zozTvsM3_6IjrrCGW-6C1mtH35bk4J6TwsT7uwaWb0I"],
  [39, "Algirdas Matijošaitis", "https://www.linkedin.com/in/matisbranding/", "https://media.licdn.com/dms/image/v2/C4E03AQGbIzjjWmdNQg/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1534879973967?e=1793836800&v=beta&t=zR50tN5GANVyZ_5Fwzx8fjaUupgo4DgpjJjkfQPZGsw"],
  [40, "Allie Astell", "https://www.linkedin.com/in/managemywebsite/", "https://media.licdn.com/dms/image/v2/D4E03AQGxp4aItermAQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1689945536363?e=1793836800&v=beta&t=H0o_EdkUWt8rOMWx28rUaK0GzI3msLRZcGj_bN7LLGg"],
  [41, "Andrea Contreras", "https://www.linkedin.com/in/andrea-contreras-ac/", "https://media.licdn.com/dms/image/v2/C4E03AQF3rGFVhCH6RQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1636299252964?e=1793836800&v=beta&t=tJIBwMGfE4c13jRDizeWbcZcqfDPatXJaVzfU1oDdRU"],
  [42, "Andrés Max", "https://www.linkedin.com/in/andresmax/", "https://media.licdn.com/dms/image/v2/D4E03AQFLCbUypmW4Lg/profile-displayphoto-crop_800_800/B4EZwu0C8fIMAI-/0/1770311924334?e=1793836800&v=beta&t=sxDBLjUzeZfWyF-Kyibeiz8O_sa118U3Mljkq2qqr5A"],
  [43, "Andrew Bossola", "https://www.linkedin.com/in/oasiscreative/", "https://media.licdn.com/dms/image/v2/D4E03AQHX8g2LB_SEWQ/profile-displayphoto-crop_800_800/B4EZs4f92XKgAM-/0/1766179463079?e=1793836800&v=beta&t=Z7yhW48cw_AFhoV6hQ5NBD4BuOcfXDn4m0RspPTpnZI"],
  [44, "Anita Martin", "https://www.linkedin.com/in/dr-anitamartin/", "https://media.licdn.com/dms/image/v2/D5603AQHNRYy9weqTZQ/profile-displayphoto-crop_800_800/B56Zjh.WIKIAAM-/0/1756137874775?e=1793836800&v=beta&t=rb6t15kiY-54qHlzEWEgI9OHvmBPGHgI2qM7xMxXUlo"],
  [45, "Anthony Cody", "https://www.linkedin.com/in/anthony-cody-04a7373/", "https://media.licdn.com/dms/image/v2/C4E03AQFnT7pFjZINIw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1516318136037?e=1793836800&v=beta&t=wsx-nuwPnZwvngYoVZFWlsf8F2EKFQOhepT7S36xiPw"],
  [46, "Ari Kaplan", "https://www.linkedin.com/in/ari-kaplan-5289a78/", "https://media.licdn.com/dms/image/v2/D4E03AQFJ7QNmLC4Uzw/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1665607594707?e=1793836800&v=beta&t=5gnU3Ip3Ec6RIMpjXG35iSN02It-ZsywqzF2duHCIUQ"],
  [47, "Bart Ebbekink", "https://www.linkedin.com/in/bartebbekink/", "https://media.licdn.com/dms/image/v2/C4E03AQFx3YIF_2GnZA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1585752265890?e=1793836800&v=beta&t=STP8yMMFkkqrRUUa4tRzcKxYBqjkvzhiua7UN-TNJnI"],
  [48, "Béla Spohrer", "https://www.linkedin.com/in/belaspohrer/", "https://media.licdn.com/dms/image/v2/C5603AQEnGVYz7Qi9mQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1648652101562?e=1793836800&v=beta&t=nxgu8vcyKE_GQ9ZtGogRUH9hH5wZvXQD7dBrLqxZLdY"],
  [49, "Ben Gathard", "https://www.linkedin.com/in/bengathard/", "https://media.licdn.com/dms/image/v2/C4E03AQHoHVnE_KqmaQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1542636316423?e=1793836800&v=beta&t=wh3jnpHi9MZCQM6zvTkttFcjBLHfPngbF5SArdxmm0A"],
  [50, "Ben Johnson", "https://www.linkedin.com/in/elegantseagulls/", "https://media.licdn.com/dms/image/v2/D5603AQGnLbXAUv4eOA/profile-displayphoto-shrink_800_800/B56ZWviVDRGoAc-/0/1742406767327?e=1793836800&v=beta&t=Z7rO2OJtNDDCX_uJJcVQbWGKj1pHBxNUpQAwfbBBdtQ"],
  [51, "Bojan Mesar", "https://www.linkedin.com/in/webdevelopment/", "https://media.licdn.com/dms/image/v2/C4E03AQHL-fNMQR7OJQ/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1642777431835?e=1793836800&v=beta&t=LdV1QIxJqTzRNJzSF36TgVp2_aJxHssLJjKrygnj2U0"],
  [52, "Braden Klingaman", "https://www.linkedin.com/in/bradenklingaman/", "https://media.licdn.com/dms/image/v2/D5603AQH6sDncuup5rg/profile-displayphoto-crop_800_800/B56aBFPiS9J4AI-/0/1787868097721?e=1793836800&v=beta&t=xmA9A0okFqSekq_nZj7jcChzJZ63Uu9e_KiqilZP6xI"],
  [53, "Brandon Doyle", "https://www.linkedin.com/in/brandonmdoyle/", "https://media.licdn.com/dms/image/v2/D5603AQHM_sM_WJnumA/profile-displayphoto-crop_800_800/B56Zqokz2VH8AQ-/0/1763764815282?e=1793836800&v=beta&t=tGPH-Iz8zaYy5-dVW_2oUDu94JfugH7Dk8AzRCrpI1I"],
  [54, "Brett Bowden", "https://www.linkedin.com/in/brettbowdentx/", "https://media.licdn.com/dms/image/v2/C4E03AQHXAuzNJbBX_A/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516330321824?e=1793836800&v=beta&t=LUI2oOOpXBiA7lIcE0apuZt1GS3QtAuREaH2vw8cMNE"],
  [55, "Brian Saemann", "https://www.linkedin.com/in/brian-saemann-seo-and-cro-05214230/", "https://media.licdn.com/dms/image/v2/D4E03AQEHnM4TqiIMwQ/profile-displayphoto-shrink_800_800/B4EZSo8biIHgAg-/0/1738001201574?e=1793836800&v=beta&t=mU7swqCdLQwtTyB0sD1wsRAlUnZ5QCNpNVMZiWcSQJM"],
  [56, "Caleb Rhoadarmer", "https://www.linkedin.com/in/calebrhoadarmer/", "https://media.licdn.com/dms/image/v2/D5603AQF_RvQPCsVEyA/profile-displayphoto-crop_800_800/B56ZoH0FLoHkAI-/0/1761067685949?e=1793836800&v=beta&t=6eyp4N_b6_AR--Coi3ZIuzLjASHbgWVCwm4jk5XmkzE"],
  [57, "Cathleen Mitchell", "https://www.linkedin.com/in/cathleen-mitchell-a624211/", "https://media.licdn.com/dms/image/v2/D5603AQG5PQaljKyR1g/profile-displayphoto-crop_800_800/B56Z4mwdnXHEAI-/0/1778766700745?e=1793836800&v=beta&t=oYhmkp4uYsZ_V_1uItse4guBepJ40a4tlH6E5jIwqdg"],
  [58, "Chris Hanscom", "https://www.linkedin.com/in/hanscom/", "https://media.licdn.com/dms/image/v2/C5103AQGXQfFMqkgnPQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1516362333814?e=1793836800&v=beta&t=nmGkNTDz86N1_vOfRfh5oyuSzFP4ozOX6FKUWXv7TBY"],
  [59, "Christina Springstead", "https://www.linkedin.com/in/christinaspringstead/", "https://media.licdn.com/dms/image/v2/D5603AQGfIp38md6Fiw/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1700288880273?e=1793836800&v=beta&t=gBuyVcDrF3NvDzjCAj5aplXk_XK1TkxJbyAn5Ek02Vo"],
  [60, "Colleen Bauer", "https://www.linkedin.com/in/colleen-bauer-5b162413a/", "https://media.licdn.com/dms/image/v2/C4D03AQG8org0_lJ56g/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1517601850671?e=1793836800&v=beta&t=n3GKgzfZBZpi_X-2F2MkkD-xUlIRjFHpAE1IPff80FQ"],
  [61, "Cooper Harris", "https://www.linkedin.com/in/cooperharris/", "https://media.licdn.com/dms/image/v2/D5603AQGV6ZmojHmAUw/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1680829928191?e=1793836800&v=beta&t=7XYaBAY1swUDRPUJfu4R9JRDEeY7yEfANQfjnZzmVow"],
  [62, "Cory Jenkins", "https://www.linkedin.com/in/cory-jenkins-b4857778/", "https://media.licdn.com/dms/image/v2/D4E03AQEmKNGjjB1JTw/profile-displayphoto-shrink_800_800/B4EZXsCjrNGgAc-/0/1743421874605?e=1793836800&v=beta&t=FxzvUUlOJG-OGZD_fTayLBn6jDjj8xKqazrfd3nKe98"],
  [63, "Crystalee Beck", "https://www.linkedin.com/in/crystalee/", "https://media.licdn.com/dms/image/v2/D5603AQE7bMf8n4szTg/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1698119367345?e=1793836800&v=beta&t=uc2VS-KaRFag-0k-EmzmS_pZg8gymzYAajENj4uXFAM"],
  [64, "Damon Gochneaur", "https://www.linkedin.com/in/damongochneaur/", "https://media.licdn.com/dms/image/v2/C5603AQFZCzO68Ob4YA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516340366358?e=1793836800&v=beta&t=jtZS762TNBMukyARG9wEI-Kd-Jz2NS1iqm15dG7itks"],
  [65, "Dan West", "https://www.linkedin.com/in/westwerk/", "https://media.licdn.com/dms/image/v2/D5603AQExcWLwsbSXpA/profile-displayphoto-crop_800_800/B56Z0NNeVAJkAI-/0/1774043130742?e=1793836800&v=beta&t=FjxuBhHEaEPEdBSusgTygz2z_OvTFRr3to-Y8T_z_Fo"],
  [66, "Daniel Andor", "https://www.linkedin.com/in/daniandor/", "https://media.licdn.com/dms/image/v2/D4D03AQG3D7LTQcUAvQ/profile-displayphoto-shrink_800_800/B4DZdwEzntH4Ac-/0/1749931998166?e=1793836800&v=beta&t=BoF6X9tO-e875Drvd5QIBDPfoih3OMJOO0qM6Ub_p4o"],
  [67, "Daniel Rothier", "https://www.linkedin.com/in/danielrothier/", "https://media.licdn.com/dms/image/v2/C4D03AQHIt2rV1zlnnA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1662130718371?e=1793836800&v=beta&t=nuRmDsZNyq_PcPSESyC1S2NPMMSei4BWb3MogFtB9cc"],
  [68, "Darren Shaw", "https://www.linkedin.com/in/darrenshawwhitespark/", "https://media.licdn.com/dms/image/v2/D5603AQGPRN78FYknrA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1685132735631?e=1793836800&v=beta&t=CJXQV5suLefb3_caAFgYIoBRY1xQAilxWj85Zox7wHU"],
  [69, "Dave Collins", "https://www.linkedin.com/in/dave-collins-a145668/", "https://media.licdn.com/dms/image/v2/C4E03AQGp6Xg6-F6Irg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1517723437470?e=1793836800&v=beta&t=V0S1XxpcXKE2rlfs-vCcIq-M3k2Zk-5TUUtntIocRHE"],
  [70, "David Dimeola", "https://www.linkedin.com/in/david-dimeola-4b81204/", "https://media.licdn.com/dms/image/v2/D4E03AQGsZUghxlTS2Q/profile-displayphoto-crop_800_800/B4EZuRF9n7LUAI-/0/1767665818476?e=1793836800&v=beta&t=5IYJTDAUJhjfo2_NKzPIrraC6AvOTC_nqs3OVNpYRpo"],
  [71, "David Elson", "https://www.linkedin.com/in/david-elson-b7a0485/", "https://media.licdn.com/dms/image/v2/D5603AQHSRQD6vgOW8Q/profile-displayphoto-scale_100_100/B56ZjS.46NHAAg-/0/1755886358624?e=1793836800&v=beta&t=4EdzptYTFC-wt6Arh4neZ4NGN-4c4z5HMTL_LuHQPbY"],
  [72, "David Kutcher", "https://www.linkedin.com/in/davidkutcher/", "https://media.licdn.com/dms/image/v2/D4E03AQGRO64q83VSbA/profile-displayphoto-crop_800_800/B4EZkpSeRXIwAI-/0/1757334332839?e=1793836800&v=beta&t=t9djNigvEbpC783RGsJGPBwveh5-P0xt3xtvF6RKF6o"],
  [73, "David Lai", "https://www.linkedin.com/in/davidalanlai/", "https://media.licdn.com/dms/image/v2/D5603AQEl5K8ard2RRg/profile-displayphoto-crop_800_800/B56Z8.EaUhKUAI-/0/1783452772860?e=1793836800&v=beta&t=ZSEudyBbk3xfwjEAZ02EbmNq0pLF5BfpyxvYX0797OE"],
  [75, "Don Kopecky", "https://www.linkedin.com/in/don-kopecky-5b309b106/", "https://media.licdn.com/dms/image/v2/D5603AQGrOAQqyJanTQ/profile-displayphoto-scale_100_100/B56Zwqg4N3IsAc-/0/1770239796434?e=1793836800&v=beta&t=TSKProzrAyZkdQ29gJ95yddxBtQm0_2k2IXVm6YlfwM"],
  [76, "Eric Huelsman", "https://www.linkedin.com/in/eric-huelsman-9655472/", "https://media.licdn.com/dms/image/v2/D4D03AQGIXz-15P9KFg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1727115432330?e=1793836800&v=beta&t=GGqrPnkjBDP4aErhi0Qei_mk4DO1L-xtpShYVKRN690"],
  [77, "Eric Mayville", "https://www.linkedin.com/in/ericmayville/", "https://media.licdn.com/dms/image/v2/D4E03AQHUGqe6dK6vFQ/profile-displayphoto-shrink_800_800/B4EZSuajMbGgAg-/0/1738092983490?e=1793836800&v=beta&t=JzouZxTPgfV7dbBN6wLxUiCOucQ0o-bKzSNLJ8IZGg4"],
  [78, "Erik Sogn", "https://www.linkedin.com/in/eriksogn/", "https://media.licdn.com/dms/image/v2/C5603AQEOcDirtcr-XA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1516610728798?e=1793836800&v=beta&t=2NEiV_WhELk7wfEn9DiRWeDykyYShnQON3Edvi_kKVc"],
  [79, "Felix Figuereo", "https://www.linkedin.com/in/felixfiguereo/", "https://media.licdn.com/dms/image/v2/D5603AQGCl-sSDISWdA/profile-displayphoto-crop_800_800/B56ZeJi9lLH8AI-/0/1750359333568?e=1793836800&v=beta&t=-vA0OjJ9OciXlt1vA58BVYCjN62Vj11zacSWZ5VFL4U"],
  [80, "Frank Murch", "https://www.linkedin.com/in/frankbmurch/", "https://media.licdn.com/dms/image/v2/D5603AQEZJhr82N2gVQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1672884473254?e=1793836800&v=beta&t=8x5WgE5INN6YqoYVfM77t1cTqFFVpdnOuiwrQzn8VX4"],
  [81, "Franklin Foster", "https://www.linkedin.com/in/fosterfranklin/", "https://media.licdn.com/dms/image/v2/C5603AQE_RyAO1hR7gA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1578936937963?e=1793836800&v=beta&t=leF0n4gdPY3In7UE9wLTgArD8nqGTyESRAKeHiHXk5w"],
  [83, "Gaurav Shah", "https://www.linkedin.com/in/dynamicdreamz/", "https://media.licdn.com/dms/image/v2/D4D03AQGrGple9w1LQw/profile-displayphoto-crop_800_800/B4DZnNFpabH0AI-/0/1760082434821?e=1793836800&v=beta&t=9NQrviadVbWun3TU-LySDRmfMn5AOqdEzvlH-F6x66w"],
  [84, "Heather Yacenda", "https://www.linkedin.com/in/heather-yacenda-41143460/", "https://media.licdn.com/dms/image/v2/C5103AQGpHdi5vzwg_A/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1517548707437?e=1793836800&v=beta&t=cnb5MYb3yHwIrjUwg3ReeytY3rCOCvG_3z4kKWSByM4"],
];

const dir = "public/contact-avatars";
await mkdir(dir, { recursive: true });
const manifestPath = `${dir}/manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const db = new PGlite(".data/pglite");
await db.exec("alter table contact_photo_assets add column if not exists src160 text not null default ''; alter table contact_photo_assets add column if not exists bytes160 int not null default 0; alter table contact_photo_assets drop constraint if exists contact_photo_assets_permission_basis_check; alter table contact_photo_assets add constraint contact_photo_assets_permission_basis_check check (permission_basis in ('contact_consent', 'copyright_license', 'user_provided', 'owner_authorized')); alter table contact_photo_assets drop constraint if exists contact_photo_assets_source_kind_check; alter table contact_photo_assets add constraint contact_photo_assets_source_kind_check check (source_kind in ('provided', 'licensed', 'official', 'social', 'other'));");
const results = [];
for (const [id, name, sourceUrl, imageUrl] of photos) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`download HTTP ${response.status}`);
    const original = Buffer.from(await response.arrayBuffer());
    const [small, large, detail] = await Promise.all([
      sharp(original).resize(64, 64, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer(),
      sharp(original).resize(104, 104, { fit: "cover", position: "centre" }).webp({ quality: 84 }).toBuffer(),
      sharp(original).resize(160, 160, { fit: "cover", position: "centre" }).webp({ quality: 85 }).toBuffer(),
    ]);
    await writeFile(`${dir}/${id}-64.webp`, small);
    await writeFile(`${dir}/${id}-104.webp`, large);
    await writeFile(`${dir}/${id}-160.webp`, detail);
    const asset = {
      src64: `/contact-avatars/${id}-64.webp`, src104: `/contact-avatars/${id}-104.webp`, src160: `/contact-avatars/${id}-160.webp`,
      permissionBasis: "owner_authorized", matchBasis: "owner-authorized LinkedIn import; exact saved profile URL and displayed profile name verified",
    };
    manifest[String(id)] = asset;
    const sha = createHash("sha256").update(original).digest("hex");
    const exists = await db.query("select id from contacts where id = $1 and deleted_at is null", [id]);
    if (!exists.rows.length) throw new Error("contact is no longer active");
    await db.query("insert into contact_photo_assets (contact_id,src64,src104,src160,source_kind,source_url,permission_basis,match_basis,asset_sha256,bytes64,bytes104,bytes160) values ($1,$2,$3,$4,'social',$5,'owner_authorized',$6,$7,$8,$9,$10) on conflict (contact_id) do update set src64=excluded.src64,src104=excluded.src104,src160=excluded.src160,source_kind=excluded.source_kind,source_url=excluded.source_url,permission_basis=excluded.permission_basis,match_basis=excluded.match_basis,asset_sha256=excluded.asset_sha256,bytes64=excluded.bytes64,bytes104=excluded.bytes104,bytes160=excluded.bytes160,updated_at=now()", [id, asset.src64, asset.src104, asset.src160, sourceUrl, asset.matchBasis, sha, small.length, large.length, detail.length]);
    results.push({ id, name, status: "added", bytes64: small.length, bytes104: large.length, bytes160: detail.length });
  } catch (error) { results.push({ id, name, status: "skipped", reason: String(error) }); }
}
await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
await rename(`${manifestPath}.tmp`, manifestPath);
await db.close();
console.log(JSON.stringify(results, null, 2));
