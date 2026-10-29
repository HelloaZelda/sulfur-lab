import React, { useEffect, useRef, useState } from "react";
      import { createRoot } from "react-dom/client";
      import * as THREE from "three";
      import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
      import htm from "htm";

      const html = htm.bind(React.createElement);

      const MODES = [
        {
          id: "atom",
          label: "原子",
          kicker: "S · Z = 16",
          title: "硫原子",
          description:
            "硫位于第三周期、第 16 族（氧族）。中性原子有 16 个电子：K 层 2 个，L 层 8 个，M 层 6 个；价电子为 3s² 3p⁴。",
          stats: [
            ["电子排布", "[Ne] 3s² 3p⁴"],
            ["电子层", "2 · 8 · 6"],
            ["原子量", "32.06 u"],
            ["常见氧化态", "−2, 0, +4, +6"],
          ],
          oxidation: [
            { label: "H₂S", value: "−2", x: 12 },
            { label: "S₈", value: "0", x: 34 },
            { label: "SO₂", value: "+4", x: 67 },
            { label: "SO₃ / H₂SO₄", value: "+6", x: 90 },
          ],
          footnote: "原子核与电子层为示意模型，未按真实尺度绘制。",
        },
        {
          id: "s8",
          label: "S₈ 分子",
          kicker: "S₈ · 皇冠形环",
          title: "八元硫环",
          description:
            "元素硫常以 S₈ 分子存在。八个硫原子形成非平面的皇冠形环，S–S 键长约 2.05 Å。",
          stats: [
            ["分子式", "S₈"],
            ["构型", "皇冠形 / 非平面"],
            ["S–S 键长", "约 2.05 Å"],
            ["键角", "约 108°"],
            ["同素异形体", "菱形硫 α-S₈、单斜硫 β-S₈"],
          ],
          footnote: "环的起伏被夸张以便观察；真实构型更平缓。",
        },
        {
          id: "crystal",
          label: "晶格",
          kicker: "α-S₈ · 菱形硫",
          title: "菱形硫晶格",
          description:
            "菱形硫（α-S₈）由 S₈ 分子堆积成晶体。单斜硫（β-S₈）是另一同素异形体；两者在熔点附近可相互转化。",
          stats: [
            ["晶系", "正交 / 菱形硫"],
            ["密度", "约 2.07 g/cm³"],
            ["熔点", "约 115.2 °C"],
            ["沸点", "约 444.6 °C"],
            ["存在形式", "S₈ 分子晶体"],
          ],
          footnote: "晶格为简化示意，未复现真实空间群与分子取向。",
        },
        {
          id: "reactions",
          label: "反应",
          kicker: "S → SO₂ → SO₃ → H₂SO₄",
          title: "硫的氧化链",
          description:
            "硫燃烧生成 SO₂；SO₂ 在催化剂下进一步氧化为 SO₃；SO₃ 与水反应生成硫酸。这是接触法制硫酸的核心路径。",
          stats: [
            ["第一步", "S + O₂ → SO₂"],
            ["第二步", "2 SO₂ + O₂ → 2 SO₃"],
            ["第三步", "SO₃ + H₂O → H₂SO₄"],
            ["催化剂", "V₂O₅（接触法）"],
            ["安全", "SO₂ 刺激性；H₂S 有毒"],
          ],
          equations: [
            "S + O₂ → SO₂",
            "2 SO₂ + O₂ → 2 SO₃",
            "SO₃ + H₂O → H₂SO₄",
          ],
          footnote: "粒子流为反应路径示意，非真实反应动力学。",
        },
      ];

      const S_MAT = new THREE.MeshStandardMaterial({
        color: 0xf4c542,
        roughness: 0.34,
        metalness: 0.14,
        emissive: 0x7a4d0c,
        emissiveIntensity: 0.65,
      });

      const O_MAT = new THREE.MeshStandardMaterial({
        color: 0xe06a5f,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0x5a1a16,
        emissiveIntensity: 0.55,
      });

      const H_MAT = new THREE.MeshStandardMaterial({
        color: 0xe9eef5,
        roughness: 0.48,
        metalness: 0.05,
        emissive: 0x3a4a5a,
        emissiveIntensity: 0.35,
      });

      const MOL_BOND_MAT = new THREE.MeshStandardMaterial({
        color: 0x9a7a3a,
        roughness: 0.55,
        metalness: 0.1,
      });

      function makeLabel(text, color = "#f4c542") {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 160;

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(8, 13, 20, 0.72)";
        ctx.fillRect(0, 0, 512, 160);
        ctx.strokeStyle = "rgba(244, 197, 66, 0.22)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 510, 158);
        ctx.font = "600 48px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 256, 80);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2.0, 0.62, 1);
        sprite.renderOrder = 10;
        return sprite;
      }

      function addSphere(group, position, radius, material) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material);
        mesh.position.copy(position);
        group.add(mesh);
        return mesh;
      }

      function addBond(group, a, b, radius, material) {
        const dir = new THREE.Vector3().subVectors(b, a);
        const length = dir.length();
        if (length === 0) return null;

        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, length, 8),
          material
        );
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize()
        );
        group.add(mesh);
        return mesh;
      }

      function createAtom() {
        const group = new THREE.Group();

        const protonMat = new THREE.MeshStandardMaterial({
          color: 0xd95b52,
          roughness: 0.45,
          metalness: 0.1,
          emissive: 0x3a0d0a,
          emissiveIntensity: 0.5,
        });

        const neutronMat = new THREE.MeshStandardMaterial({
          color: 0x8e9aa8,
          roughness: 0.55,
          metalness: 0.1,
        });

        const nucleus = new THREE.Group();

        for (let i = 0; i < 16; i++) {
          const proton = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 14, 10),
            protonMat
          );
          const angle = (i / 16) * Math.PI * 2;
          const radius = 0.2 + (i % 3) * 0.05;
          proton.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 2) * 0.12,
            Math.sin(angle) * radius
          );
          nucleus.add(proton);
        }

        for (let i = 0; i < 16; i++) {
          const neutron = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 14, 10),
            neutronMat
          );
          const angle = (i / 16) * Math.PI * 2 + 0.2;
          const radius = 0.24 + (i % 4) * 0.04;
          neutron.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 3) * 0.1,
            Math.sin(angle) * radius
          );
          nucleus.add(neutron);
        }

        group.add(nucleus);

        const shells = [];
        const shellData = [
          { radius: 1.15, count: 2, color: 0x4ea1ff, speed: 0.25 },
          { radius: 2.0, count: 8, color: 0x4ea1ff, speed: 0.35 },
          { radius: 2.85, count: 6, color: 0x7cc8ff, speed: 0.45 },
        ];

        for (const data of shellData) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(data.radius, 0.018, 8, 80),
            new THREE.MeshStandardMaterial({
              color: data.color,
              emissive: data.color,
              emissiveIntensity: 0.7,
              transparent: true,
              opacity: 0.45,
              roughness: 0.4,
            })
          );
          ring.rotation.x = Math.PI / 2;
          group.add(ring);

          const electronGroup = new THREE.Group();

          for (let i = 0; i < data.count; i++) {
            const electron = new THREE.Mesh(
              new THREE.SphereGeometry(0.07, 12, 10),
              new THREE.MeshStandardMaterial({
                color: data.color,
                emissive: data.color,
                emissiveIntensity: 1.1,
                roughness: 0.25,
              })
            );
            const angle = (i / data.count) * Math.PI * 2;
            electron.position.set(
              Math.cos(angle) * data.radius,
              0,
              Math.sin(angle) * data.radius
            );
            electronGroup.add(electron);
          }

          group.add(electronGroup);
          shells.push({ group: electronGroup, speed: data.speed });
        }

        group.userData.shells = shells;

        const label = makeLabel("S · 16p 16n");
        label.position.set(0, 3.7, 0);
        group.add(label);

        return group;
      }

      function createS8Molecule() {
        const group = new THREE.Group();

        const atomMat = new THREE.MeshStandardMaterial({
          color: 0xf4c542,
          roughness: 0.32,
          metalness: 0.15,
          emissive: 0x7a4d0c,
          emissiveIntensity: 0.65,
        });

        const bondMat = new THREE.MeshStandardMaterial({
          color: 0xb9892e,
          roughness: 0.5,
          metalness: 0.2,
          emissive: 0x2a1705,
          emissiveIntensity: 0.4,
        });

        const radius = 1.65;
        const crown = 0.32;
        const positions = [];

        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          positions.push(
            new THREE.Vector3(
              Math.cos(angle) * radius,
              i % 2 === 0 ? crown : -crown,
              Math.sin(angle) * radius
            )
          );
        }

        for (const position of positions) {
          const atom = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 20, 16),
            atomMat
          );
          atom.position.copy(position);
          group.add(atom);
        }

        for (let i = 0; i < 8; i++) {
          addBond(
            group,
            positions[i],
            positions[(i + 1) % 8],
            0.055,
            bondMat
          );
        }

        return group;
      }

      function createS8() {
        const group = createS8Molecule();

        const label = makeLabel("S₈ · 皇冠环");
        label.position.set(0, 2.8, 0);
        group.add(label);

        return group;
      }

      function createCrystal() {
        const group = new THREE.Group();

        const corners = [
          [-1.5, -1.5, -1.5],
          [1.5, -1.5, -1.5],
          [-1.5, 1.5, -1.5],
          [1.5, 1.5, -1.5],
          [-1.5, -1.5, 1.5],
          [1.5, -1.5, 1.5],
          [-1.5, 1.5, 1.5],
          [1.5, 1.5, 1.5],
        ];

        for (const [x, y, z] of corners) {
          const molecule = createS8Molecule();
          molecule.scale.setScalar(0.34);
          molecule.position.set(x, y, z);
          molecule.rotation.set(x * 0.25, y * 0.25, z * 0.25);
          group.add(molecule);
        }

        const center = createS8Molecule();
        center.scale.setScalar(0.28);
        center.rotation.set(0.3, 0.2, 0.1);
        group.add(center);

        const box = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 3.4, 3.4),
          new THREE.MeshBasicMaterial({
            color: 0x4ea1ff,
            wireframe: true,
            transparent: true,
            opacity: 0.18,
          })
        );
        group.add(box);

        const label = makeLabel("α-S₈ · 菱形晶格");
        label.position.set(0, 3.5, 0);
        group.add(label);

        return group;
      }

      function createSO2() {
        const group = new THREE.Group();

        const sulfur = addSphere(
          group,
          new THREE.Vector3(0, 0, 0),
          0.25,
          S_MAT
        );

        const oxygen1 = addSphere(
          group,
          new THREE.Vector3(-0.78, 0.42, 0),
          0.2,
          O_MAT
        );

        const oxygen2 = addSphere(
          group,
          new THREE.Vector3(0.78, 0.42, 0),
          0.2,
          O_MAT
        );

        addBond(group, sulfur.position, oxygen1.position, 0.045, MOL_BOND_MAT);
        addBond(group, sulfur.position, oxygen2.position, 0.045, MOL_BOND_MAT);

        return group;
      }

      function createSO3() {
        const group = new THREE.Group();

        const sulfur = addSphere(
          group,
          new THREE.Vector3(0, 0, 0),
          0.25,
          S_MAT
        );

        const oxygens = [
          new THREE.Vector3(-0.92, 0, 0),
          new THREE.Vector3(0.46, 0.8, 0),
          new THREE.Vector3(0.46, -0.8, 0),
        ];

        for (const position of oxygens) {
          addSphere(group, position, 0.2, O_MAT);
          addBond(group, sulfur.position, position, 0.045, MOL_BOND_MAT);
        }

        return group;
      }

      function createH2SO4() {
        const group = new THREE.Group();

        const sulfur = addSphere(
          group,
          new THREE.Vector3(0, 0, 0),
          0.25,
          S_MAT
        );

        const oxygen1 = addSphere(
          group,
          new THREE.Vector3(-0.9, 0, 0),
          0.2,
          O_MAT
        );

        const oxygen2 = addSphere(
          group,
          new THREE.Vector3(0.9, 0, 0),
          0.2,
          O_MAT
        );

        const oxygen3 = addSphere(
          group,
          new THREE.Vector3(0, 0.72, 0.55),
          0.18,
          O_MAT
        );

        const oxygen4 = addSphere(
          group,
          new THREE.Vector3(0, -0.72, 0.55),
          0.18,
          O_MAT
        );

        const hydrogen1 = addSphere(
          group,
          new THREE.Vector3(0, 1.12, 0.72),
          0.1,
          H_MAT
        );

        const hydrogen2 = addSphere(
          group,
          new THREE.Vector3(0, -1.12, 0.72),
          0.1,
          H_MAT
        );

        for (const oxygen of [oxygen1, oxygen2, oxygen3, oxygen4]) {
          addBond(group, sulfur.position, oxygen.position, 0.045, MOL_BOND_MAT);
        }

        addBond(group, oxygen3.position, hydrogen1.position, 0.035, MOL_BOND_MAT);
        addBond(group, oxygen4.position, hydrogen2.position, 0.035, MOL_BOND_MAT);

        return group;
      }

      function createReactions() {
        const group = new THREE.Group();

        const so2 = createSO2();
        so2.position.set(-3.2, 0, 0);
        group.add(so2);

        const so3 = createSO3();
        so3.position.set(0, 0, 0);
        group.add(so3);

        const h2so4 = createH2SO4();
        h2so4.position.set(3.2, 0, 0);
        group.add(h2so4);

        const labels = [
          ["SO₂", -3.2],
          ["SO₃", 0],
          ["H₂SO₄", 3.2],
        ];

        for (const [text, x] of labels) {
          const label = makeLabel(text);
          label.position.set(x, 1.7, 0);
          group.add(label);
        }

        const arrow1 = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-2.1, 0.1, 0),
          1.7,
          0x4ea1ff,
          0.18,
          0.12
        );

        const arrow2 = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(1.1, 0.1, 0),
          1.7,
          0x4ea1ff,
          0.18,
          0.12
        );

        group.add(arrow1, arrow2);

        const flow = new THREE.Group();
        const particleMat = new THREE.MeshBasicMaterial({
          color: 0x9fd0ff,
          transparent: true,
          opacity: 0.85,
        });

        for (let i = 0; i < 6; i++) {
          const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 10, 8),
            particleMat
          );
          particle.position.set(-2.4 + i * 0.8, 0.1, 0);
          flow.add(particle);
        }

        group.add(flow);
        group.userData.flow = flow;

        return group;
      }

      function Scene({ mode, autoRotate, reactionPlaying }) {
        const hostRef = useRef(null);
        const stateRef = useRef(null);

        useEffect(() => {
          const host = hostRef.current;
          if (!host) return;

          let renderer;
          try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
          } catch (error) {
            host.innerHTML =
              '<div class="webgl-error">WebGL 不可用，无法渲染 3D 场景。</div>';
            return;
          }

          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          host.appendChild(renderer.domElement);

          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0x080d12);
          scene.fog = new THREE.FogExp2(0x080d12, 0.028);

          const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
          camera.position.set(4.2, 2.8, 6.5);

          const controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.06;
          controls.enablePan = false;
          controls.minDistance = 3;
          controls.maxDistance = 18;
          controls.autoRotate = autoRotate;
          controls.autoRotateSpeed = 0.7;
          controls.target.set(0, 0, 0);

          scene.add(new THREE.HemisphereLight(0xb9d4ff, 0x1c1308, 0.75));

          const key = new THREE.DirectionalLight(0xffe0a0, 2.2);
          key.position.set(5, 7, 4);
          scene.add(key);

          const rim = new THREE.PointLight(0x4ea1ff, 5, 20);
          rim.position.set(-5, -2, -4);
          scene.add(rim);

          const fill = new THREE.PointLight(0xffc45c, 2, 14);
          fill.position.set(4, -3, 3);
          scene.add(fill);

          const grid = new THREE.GridHelper(14, 14, 0x2a3542, 0x121922);
          grid.position.y = -2.4;
          scene.add(grid);

          const atomGroup = createAtom();
          const s8Group = createS8();
          const crystalGroup = createCrystal();
          const reactionGroup = createReactions();
          scene.add(atomGroup, s8Group, crystalGroup, reactionGroup);

          const goals = {
            atom: {
              position: new THREE.Vector3(4.2, 2.8, 6.5),
              target: new THREE.Vector3(0, 0, 0),
            },
            s8: {
              position: new THREE.Vector3(0, 2.4, 7.5),
              target: new THREE.Vector3(0, 0, 0),
            },
            crystal: {
              position: new THREE.Vector3(5.4, 4.2, 7.0),
              target: new THREE.Vector3(0, 0, 0),
            },
            reactions: {
              position: new THREE.Vector3(0, 2.6, 9.0),
              target: new THREE.Vector3(0, 0, 0),
            },
          };

          stateRef.current = {
            scene,
            camera,
            renderer,
            controls,
            goals,
            groups: {
              atom: atomGroup,
              s8: s8Group,
              crystal: crystalGroup,
              reactions: reactionGroup,
            },
            autoRotate,
            reactionPlaying,
            cameraGoalActive: true,
            cameraGoal: (goals[mode] || goals.atom).position.clone(),
            targetGoal: (goals[mode] || goals.atom).target.clone(),
          };

          const resize = () => {
            const width = host.clientWidth || 640;
            const height = host.clientHeight || 460;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          };

          resize();

          const observer = new ResizeObserver(resize);
          observer.observe(host);

          const clock = new THREE.Clock();
          let raf = 0;

          const animate = () => {
            raf = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();
            const state = stateRef.current;
            if (!state) return;

            if (state.cameraGoalActive) {
              camera.position.lerp(state.cameraGoal, 0.06);
              controls.target.lerp(state.targetGoal, 0.06);

              if (camera.position.distanceTo(state.cameraGoal) < 0.06) {
                state.cameraGoalActive = false;
              }
            }

            controls.autoRotate = state.autoRotate && !state.cameraGoalActive;

            if (atomGroup.visible) {
              atomGroup.userData.shells.forEach((shell) => {
                shell.group.rotation.y = elapsed * shell.speed;
              });
            }

            if (s8Group.visible) {
              s8Group.rotation.y = elapsed * 0.14;
              s8Group.rotation.x = Math.sin(elapsed * 0.4) * 0.04;
            }

            if (crystalGroup.visible) {
              crystalGroup.rotation.y = elapsed * 0.09;
            }

            if (reactionGroup.visible) {
              const flow = reactionGroup.userData.flow;

              if (state.reactionPlaying) {
                flow.visible = true;

                flow.children.forEach((particle, index) => {
                  const phase =
                    (elapsed * 0.35 + index / flow.children.length) % 1;
                  particle.position.x = -2.4 + phase * 4.8;
                  particle.position.y =
                    0.1 + Math.sin(phase * Math.PI * 2) * 0.18;
                  particle.position.z =
                    Math.sin(phase * Math.PI * 2 + index * 0.9) * 0.14;
                });
              } else {
                flow.visible = false;
              }
            }

            controls.update();
            renderer.render(scene, camera);
          };

          animate();

          return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            controls.dispose();
            renderer.dispose();
            host.removeChild(renderer.domElement);
            stateRef.current = null;
          };
        }, []);

        useEffect(() => {
          const state = stateRef.current;
          if (!state) return;

          state.autoRotate = autoRotate;
          state.reactionPlaying = reactionPlaying;
          state.controls.autoRotate = autoRotate;

          Object.entries(state.groups).forEach(([key, group]) => {
            group.visible = key === mode;
          });

          const goal = state.goals[mode];
          if (goal) {
            state.cameraGoal = goal.position.clone();
            state.targetGoal = goal.target.clone();
            state.cameraGoalActive = true;
          }
        }, [mode, autoRotate, reactionPlaying]);

        return html`
          <div
            class="viewport"
            ref=${hostRef}
            role="img"
            aria-label="硫的 3D 化学结构，可拖动旋转和缩放"
          ></div>
        `;
      }

      function App() {
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        const [mode, setMode] = useState("atom");
        const [autoRotate, setAutoRotate] = useState(!reducedMotion);
        const [reactionPlaying, setReactionPlaying] = useState(!reducedMotion);

        const info = MODES.find((item) => item.id === mode) || MODES[0];

        return html`
          <div class="app">
            <header class="topbar">
              <div class="brand">
                <div class="symbol" aria-hidden="true">S</div>
                <div>
                  <h1>硫 · Sulfur</h1>
                  <p class="subtitle">原子序数 16 · 第三周期 · 第 16 族</p>
                </div>
              </div>
              <div class="badge">INTERACTIVE CHEMISTRY</div>
            </header>

            <main class="layout">
              <section class="stage" aria-labelledby="stage-title">
                <div class="stage-head">
                  <div>
                    <p class="kicker">${info.kicker}</p>
                    <h2 id="stage-title">${info.title}</h2>
                  </div>
                  <div class="stage-tools">
                    <button
                      type="button"
                      class="ghost"
                      onClick=${() => setAutoRotate((value) => !value)}
                      aria-pressed=${autoRotate}
                    >
                      ${autoRotate ? "自动旋转：开" : "自动旋转：关"}
                    </button>
                    ${mode === "reactions"
                      ? html`
                          <button
                            type="button"
                            class="primary"
                            onClick=${() =>
                              setReactionPlaying((value) => !value)}
                          >
                            ${reactionPlaying ? "暂停反应" : "播放反应"}
                          </button>
                        `
                      : null}
                  </div>
                </div>

                <${Scene}
                  mode=${mode}
                  autoRotate=${autoRotate}
                  reactionPlaying=${reactionPlaying}
                />

                <div class="stage-caption">
                  <span>拖动旋转 · 滚轮缩放</span>
                  <span>${info.footnote}</span>
                </div>
              </section>

              <aside class="panel" aria-label="硫的结构信息">
                <div class="tabs" role="tablist" aria-label="结构模式">
                  ${MODES.map(
                    (item) => html`
                      <button
                        type="button"
                        key=${item.id}
                        class=${`tab ${item.id === mode ? "active" : ""}`}
                        onClick=${() => setMode(item.id)}
                        role="tab"
                        aria-selected=${item.id === mode}
                      >
                        ${item.label}
                      </button>
                    `
                  )}
                </div>

                <div class="panel-body" aria-live="polite">
                  <p class="eyebrow">${info.kicker}</p>
                  <h2>${info.title}</h2>
                  <p class="description">${info.description}</p>

                  <dl class="stats">
                    ${info.stats.map(
                      ([key, value]) => html`
                        <div class="stat" key=${key}>
                          <dt>${key}</dt>
                          <dd>${value}</dd>
                        </div>
                      `
                    )}
                  </dl>

                  ${info.equations
                    ? html`
                        <div class="equations">
                          <p class="eyebrow">关键反应</p>
                          ${info.equations.map(
                            (equation) => html`
                              <div class="equation" key=${equation}>
                                ${equation}
                              </div>
                            `
                          )}
                        </div>
                      `
                    : null}

                  ${info.oxidation
                    ? html`
                        <div class="oxidation">
                          <p class="eyebrow">氧化态</p>
                          <div class="oxidation-track">
                            ${info.oxidation.map(
                              (item) => html`
                                <div
                                  class="oxidation-mark"
                                  key=${item.value}
                                  style=${{ left: `${item.x}%` }}
                                >
                                  <span>${item.label}</span>
                                  <small>${item.value}</small>
                                </div>
                              `
                            )}
                          </div>
                        </div>
                      `
                    : null}

                  <div class="legend">
                    <span><i class="dot sulfur"></i>硫 S</span>
                    <span><i class="dot oxygen"></i>氧 O</span>
                    <span><i class="dot hydrogen"></i>氢 H</span>
                    <span><i class="dot electron"></i>电子</span>
                  </div>
                </div>
              </aside>
            </main>

            <footer class="footer">
              <span>3D 结构为教学示意；晶体与电子层经过简化。</span>
              <span>H₂S 有毒，SO₂ 刺激性；请勿在无通风环境接触。</span>
            </footer>
          </div>
        `;
      }

      createRoot(document.getElementById("root")).render(html`<${App} />`);
