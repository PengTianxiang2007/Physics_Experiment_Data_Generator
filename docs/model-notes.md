# Physics reference for the laboratory data generator

Source inspected: uploaded *Introductory Physics Experiments for Undergraduates* (付浩，科学出版社，2017). It is a scanned PDF: printed page N corresponds to PDF page N+7. All page references below are printed pages. Tables are governed by the uploaded DOCX/ZIP even when the textbook uses different numbering.

## Coverage and numbering

The uploaded schedule screenshot labels current second-semester work Lab 6 Michelson, Lab 7 spectrometer, Lab 8 Franck–Hertz, Lab 9 Millikan, Lab 10 photoelectric, Lab 11 potentiometer. These correspond to textbook/DOCX experiments 08,09,10,11,14,15. The DOCX additionally includes experiments 12 bridge/balance and 13 ultrasound; include as supplementary experiments. ZIP tables contain first-semester exp01 resistance+diode, exp03 oscilloscope, exp04 Young modulus, exp06 Newton rings, exp07 polarization. No editable tables for textbook exp02 Hall or exp05 holography were supplied. Total supplied coverage: 13 experiments, 33 tables.

Use experiment names prominently and retain original table IDs. Distinguish course lab number from textbook chapter number to avoid a Lab 6/Newton-rings/Michelson mix-up.

## Shared uncertainty and generation rules

- A generated dataset is a simulation, not an observation. Preserve manually entered cells exactly. Do not invent a teacher's signature or imply instrumentation certification.
- Standard uncertainty of a repeated-measurement mean: u_A = s/sqrt(n), s² = sum((x_i−mean)²)/(n−1). Do not apply s/sqrt(n) to a sweep of different physical conditions.
- Textbook pp22–23: u_instr = Δ_instr/sqrt(3), u_read = Δ_read/sqrt(3); u_B = sqrt(u_instr²+u_read²); u_c = sqrt(u_A²+u_B²).
- Textbook p22: analog estimating/readout error is 0.2 times the smallest marked division. p23: no additional estimating error for vernier or digital instrument displays. This convention differs from the common half-division rule; follow uploaded textbook unless user overrides.
- Textbook pp27–28: analog electric instrument Δ_instr = accuracy class in percent × full scale. Digital Δ_instr = a%×reading + count×last digit. Do not confuse resolution with instrument error.
- Textbook p25: uncertainty generally 1 significant digit (2 when leading digit 1, possibly2); final result rounded to matching decimal position. Preserve extra digits in intermediate calculations.
- A settable random standard deviation σ controls simulated scatter. It is distinct from instrument error limit Δ, combined standard uncertainty u_c, and expanded uncertainty U=k u_c. If user sets a target uncertainty, calculate achieved uncertainty and reject/report incompatible constraints; do not merely print the target as achieved.
- Instrument parameters are often inputs, not random measurements: instrument range, internal resistance, division, scale multipliers, calibration constants should be fixed when entered.
- Defaults not explicitly provided below are simulation assumptions. Expose them as editable.
- Recommended constraint behavior: parameter fit only to unlocked model parameters; exact locked cells preserved; validate residuals against configured tolerance; conflicting fixed input means report a conflict rather than silently changing it.

## exp01 Resistance and diode (pp50–63)

- Small-R ammeter outside: I_total = V/Rx + V/Rv. Apparent R=V/I_total; corrected Rx=V/(I_total−V/Rv).
- Ammeter inside: V = I(Rx+Ra). Apparent R=V/I; corrected Rx=V/I−Ra.
- Tables use current mA and voltage V: convert mA to A for resistance Ω.
- Fixable parameters: accepted Rx1/Rx2, each selected Rv/Ra, analog accuracy classes, each range, divisions/readout error, source scan voltages.
- Textbook p55 qualitative diode curve has forward knee around0.6–0.8V and reverse breakdown around5V. It does not name a specific diode model or precise breakdown voltage.
- p58 forward ranges0–1.5V and0–30mA; reverse0–7.5V and0–30mA. Table fixed positive reverse voltage/current values are magnitudes. Model Zener-like reverse breakdown with editable Vz; default5.1V is an assumption, not a textbook apparatus value.
- For forward simulation use Shockley-like smooth I(V) with series resistance, or a disclosed phenomenological curve; reverse use leakage below Vz plus increasing current above it. Preserve fixed current levels5,10,15,20,25,30mA and solve their corresponding voltages.

## exp03 Oscilloscope (pp75–83)

- p80: Vpp = vertical sensitivity(V/cm) × height H(cm). p81: T = time sensitivity(ms/cm) × length L(cm); f=1000/T_ms.
- The supplied table's last row contains embedded mathematical labels; do not randomize formula-label cells.
- p81 Lissajous Nx/Ny=fy/fx. Fixed CH2 frequency50Hz, generator applied CH1. With standard CH1=X, CH2=Y, CH1 frequency=50×Ny/Nx. Ratios1:1,1:2,1:3,2:3,2:1 give50,100,150,75,25Hz.
- Fixable: V/div, time/div, probe multiplier, waveform frequency/amplitude. Physical screen-size limits should be sensible.

## exp04 Young modulus by optical lever (pp84–96)

- E=FL/(AΔL), A=πd²/4; optical magnification k=2D/b and scale movement Δn=(2D/b)ΔL (pp86,88).
- Thus scale movement per added mass: dn/dM=8gLD/(πd²bE), coherent SI units; convert output to mm.
- d_i=raw micrometer reading−zero reading. Fixable wire diameter, micrometer zero, L,D,b, Young modulus E, g, initial scale position, loading/unloading hysteresis.
- p88 typical b4–8cm, D1–2m. Example simulation defaults L1000mm,D1500mm,b60mm,d0.5mm,E200GPa.
- Supplied table specifically sets diameter instrument error0.01mm and evaluating errors L2mm,D5mm,b0.2mm; keep fixed source values even though generic textbook instrument chapter lists a different micrometer rule.
- Tape limit error per source table Δ(mm)=0.2×reading(mm)/1000+0.3.
- Use fixed mass sweep2–9kg; derive means from loading/unloading readings and fit slope. Warn if inferred E≤0 or inconsistent diameter/geometry.

## exp06 Newton rings (pp106–114)

- Dark rings: D_m²−D_n²=4Rλ(m−n). Use fixed orders30,25,20,15,10,5 and differences(30−15),(25−10),(20−5).
- Table convention D=D_L−D_R; coordinate orientation should ensure positive diameter consistent with source, even if a real microscope reads in reverse.
- Fixable λ (sodium yellow usually589.3nm as simulation default), R, common center coordinate, offset/central-gap order intercept, instrument resolution.
- Generate ring sides as center±sqrt(Rλ×effectiveOrder), with λ and R in mm. Compute diameter, square, paired differences, mean difference, then R=meanDifference/(4×15×λ_mm).
- Do not independently randomize left/right readings in ways that destroy ordering or shared center beyond the configured scatter.

## exp07 Polarization (pp115–125)

- Malus: I(θ)=I_dark+I0 cos²(θ−θ0). Fixed sweep0–180° at10° steps. Final spare cells in table are not measurements.
- Quarter wave ideal: linear at0/90°, circular at45°, elliptical otherwise (p121). Analyzer Imax/Imin = I_dark + I0(1±|cos2α|)/2. At ideal circular45°, intensity is constant: no distinct maxima/minima. For other angles a full360° analyzer rotation has2 maxima and2 minima.
- Half wave rotates polarization direction by2α. Two extinction positions per full turn separated180°, with orientation change2α (mod360).
- Fixable dark current, intensity, axis-zero, waveplate retardance/idealness. For a first model, ideal plate behavior plus detector scatter is appropriate. Qualitative polarization labels should follow the physical model, not be random.

## exp08 Michelson (pp126–137)

- p130 λ=2Δd/N. Table d positions at N=0,50,100,150,200,250; paired differences span150 fringes; λ_nm=2×meanΔd_mm/150×10^6.
- p135 fixed air-cell defaults L95.0mm, λ0=633.0nm, m60, p=1.01325×10^5Pa. User room temperature input; air index reference≈1.00027 at room T is a simulation assumption.
- Air table: Δp=|p2−p1| in MPa, and n=1+λ0*m*p/(2L*meanΔp) with matched length and pressure units. Pressure values can be gauge readings, but pressure differences must be absolute magnitudes. Ensure actual physically feasible pressure interval for chosen index/count.
- Fixable λ, starting screw position, gearing factor if instrument dial differs from physical displacement, L,m,pressure,index,roomT,reading resolution.

## exp09 Spectrometer (pp138–151)

- IMPORTANT: textbook uses AUTOCOLLIMATION (p143), not generic double-reflection method. α=(circDifference(θ1,θ2)+circDifference(θ1′,θ2′))/2, and prism A=180°−α. A60° yields telescope separation120°.
- Verniers1 and2 nominally180° apart. Angular readings are ° and minutes; circular mean/difference required near0/360.
- p150 explicitly warns that angles355°45′ and115°43′ have small separation119°58′, not240°02′.
- Diffraction grating d sinφ=kλ. First-order ±1 angles: φ=(circDifference(L1,R1)+circDifference(L2,R2))/4.
- Textbook p150 uses greenλ=546.07nm to calibrate d=λ_green/sinφ_green, then calculates yellow wavelengths. Yellow1≈577.0nm, Yellow2≈579.0nm (p148). No explicit density found;600lines/mm is a reasonable editable assumption (instructions say first order about20°).
- Fixable prism angle, starting left angle, grating lines/mm, zero-order angle, wavelengths, vernier eccentricity, instrument angular resolution.

## exp10 Franck–Hertz argon (pp152–162)

- p156 textbook reference first excitation for this argon experiment is about13.1V; do not substitute11.6V silently. Observed peaks/valleys recur with excitation-potential spacing, and overall current envelope increases with voltage.
- The three tables contain voltage0–79V laid out as tens row+ones column; cells store current. V1 filament, V2 first grid, V3 retarding, V4 is scan voltage (pp154–155).
- A periodic-envelope phenomenological model is appropriate for simulation, disclosed as such. Fixable period, offset/contact-potential shift, amplitude, baseline, peak width, noise; V1/V2/V3 can be recorded instrument settings, but avoid falsely claiming exact quantitative dependence unless modeled.
- Use peaks/valleys estimated from generated curve to report achieved spacing; don't merely echo period input as an experimental estimate.

## exp11 Millikan (pp163–171)

- p167 apparatus constants: oil densityρ981kg/m³; g9.79m/s²; air viscosityη1.83×10^−5kg/(m·s); fall distance l2.00×10^−3m; plate separation d5.00×10^−3m; b6.17×10^−6m·cmHg; pressure p76.0cmHg.
- p166 textbook approximation r=sqrt(9ηl/(2ρgt)). q=(18π/sqrt(2ρg)) [ηl/(t(1+b/(pr)))]^(3/2) d/V.
- With textbook constants p167 gives q=1.43×10^−14 / {[t(1+0.02sqrt(t))]^(3/2) V}. General parameter form is preferable for editable apparatus.
- Generate each oil droplet using an integer charge multiple n and suitable fall time, solve V, then three noisy repeat readings of same droplet. Do not choose each V,t independently. Ten droplets ×3 repeats; separate means.
- Fixable physical constants, per-droplet charge multiple/time/voltage, resolution/scatter. Reject impossible V≤0,t≤0. Fitting measured data to exact charge integers should be disclosed as a simulation constraint.

## exp12 Wheatstone bridge and electronic balance (pp172–183)

- p174 U_AB=U0[R3/(R3+R4)−R1/(R1+R2)]. This convention gives positive output as R3 rises; do not flip sign accidentally.
- Quarter bridge: R1=R2=R4=10kΩ (editable apparatus baseline); R3 fixed10.2…11.2kΩ.
- Half bridge: source R3=10.2…11.2kΩ,R4=9.8…8.8kΩ. Same exact formula, not only small-ΔR approximation.
- Balance calibration: U=offset+sensitivity×mass, with optional loading/unloading hysteresis; fit means to retrieve slope and use it consistently for unknown object masses.
- Last table fixed excitation input E1…10V, output proportional to E for fixed bridge resistance configuration.
- Fixable supply voltage, resistances, gain, zero offset, sensitivity, object masses, hysteresis.

## exp13 Ultrasound (pp184–195)

- Standing wave adjacent maxima spacingλ/2 (p188). Phase comparison explicitly records repeated positive-slope line (p191), so adjacent positions spacingλ, notλ/2.
- v=fλ; typical resonance around40kHz, searched35–45kHz (p189). Air sound speed temperature model≈331.45sqrt(1+T/273.15)m/s; use roomT and editable reference speed if chosen.
- Fixable frequency, temperature,speed,start positions,position resolution. Position series ascending; phase increments twice standing increments for same frequency.

## exp14 Photoelectric effect (pp196–204)

- f=c/λ; stopping magnitude U_s=(h/e)f−W/e (p201). If table records negative applied voltage instead, explicitly choose sign convention; do not mix a negative control voltage with positive kinetic-energy magnitude.
- Fixed wavelengths365,405,436,546,577nm. Choose editable work function low enough for all lines to emit if generating full table (e.g.2.0eV is simulation assumption).
- p202 current-voltage experiment uses577nm filter, distances30cm and40cm, voltages−2…50V. Currents in units10^−11A in supplied table.
- A smooth saturation curve above−U_s plus dark current is a disclosed phenomenological approximation. Intensity at40cm ~ (30/40)^2 of30cm if point-source inverse-square model selected; actual lamp geometry can deviate.
- Fixable workfunction, contactoffset, saturation current, distance/intensity law, darkcurrent, voltage/current resolution. Derive frequency exactly; regression slope gives h, intercept W when enough valid points.

## exp15 Potentiometer and thermocouple (pp205–214)

- p208 potentiometer Ex=I Rx; standard calibration current10.000mA. p211 standard emf1.0185V, multiple×1 setup. Table stores final thermal emf(mV), not raw resistance dial values.
- p209 material pair is not specified (copper/iron is illustrative only). Cold junction is reference temperature, normally recorded roomT in supplied sheet. Use editable Seebeck coefficient S and referenceT; Ex≈S(T−Tref)+curvature term over35–85°C.
- Fixable coldT, S(mV/°C), optional curvature, offset, multiplier, resolution. Clearly mark these defaults as a local linear simulation model, not certified thermocouple calibration.
