'use strict';

var App = function(makehuman, dat, _, THREE, Detector, Nanobar, Stats) {


    /**
     * A three.js app that build a scene
     * @param       {object} resources        - list of resources from makehuman-data
     * @param       {object} modeling_sliders - list of modeling_sliders from makehuman-data
     * @constructor
     */
    function App(resources, modeling_sliders) {

        this.SCREEN_WIDTH = window.innerWidth / 3 * 2;
        this.SCREEN_HEIGHT = window.innerHeight / 3 * 2;

        this.container;

        this.camera;
        this.scene;
        this.renderer;
        this.controls;

        this.mouseX = 0;
        this.mouseY = 0;

        this.human;

        this.gui;
        this.skinConfig;
        this.modifierConfig;
        this.bodyPartConfig;

        this.clock = new THREE.Clock();
        if (!Detector.webgl)
            Detector.addGetWebGLMessage();

        this.resources = resources
        this.modeling_sliders = modeling_sliders
    }

    App.prototype.init = function init(gender, height, weight, waist, barcode, body_type) {
        self = this;

        // Default gender as male.
        // if (null == gender) gender = 1;
        // // Default weight for male = 75.
        // if (null == weight && 1 == gender) weight = 75;
        // // Default weight for female = 65.
        // else if (null == weight && 0 == gender) weight = 65;
        // // Default height for male = 183
        // if (null == height && 1 == gender) height = 183;
        // // Default height for female = 167
        // else if (null == height && 0 == gender) height = 167;

        console.log("init gender = "+ gender);
        console.log("init weight = "+ weight);
        console.log("init height = "+ height);
        console.log("init waist = "+ waist);
        console.log("init barcode = "+ barcode);
        console.log("init body_type = "+ body_type);

        this.container = document.getElementById('container');
        if (!this.container)
            this.container = document.body;

        // scene
        this.scene = new THREE.Scene();

        // LIGHTS
        // sunlight from above
        var light1 = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
        this.scene.add(light1);

        // light front up
        var light2 = new THREE.DirectionalLight(0xffffff, 0.5);
        light2.position.set(0, 140, 500);
        light2.position.multiplyScalar(1.1);
        light2.color.setHSL(0.6, 0.075, 1);
        this.scene.add(light2);

        // light from ground
        var light3 = new THREE.DirectionalLight(0xffffff, 0.5);
        light3.position.set(0, -1, 0); // ground
        light3.position.set(13, 5, 0); // right (right, up, front)
        this.scene.add(light3);

        // CAMERA
        this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 2000);
        self.camera.position.set(0, 8, 40)

        // RENDERER
        if (Detector.webgl) {
            this.renderer = new THREE.WebGLRenderer({antialias: true});
        } else {
            throw Error("need webgl")
        }
        this.renderer.setSize(this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
        this.renderer.setClearColor(0xffffff);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // mouse controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 12, 0)

        // progress bar
        this.nanobar = new Nanobar({id: 'progress-bar'});

        // STATS
        this.stats = new Stats();
        // this.stats.showPanel(0);
        document.body.appendChild(this.stats.domElement);

        // events
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.controls.addEventListener('change', self.render.bind(self));

        // HUMAN
        this.human = new makehuman.Human(this.resources);
        self.scene.add(self.human);

        // load human metadata
        return new Promise(function(resolve, reject) {
            resolve()
        }).then(function() {
            self.nanobar.go(20);
            // load the base human body
            return self.human.loadModel()
        }).then(function() {
            self.nanobar.go(50);
            console.debug("Human load Complete. ", self.human.skins.length, " skins, " + self.human.mesh.geometry.morphTargets.length + " morphtargets, " + self.human.bodyPartOpacity().length + ' bodyparts');

            self.setHumanDefaults(gender, barcode)

            self.gui = new GUI(self)
            self.setModifierDefaults(gender, height, weight)

            // load targets last as it's slow
            // (it loads a ~150mb bin files with targets)
            self.human.loadTargets(`${self.resources.baseUrl}targets/${self.resources.targets}`).then(() => {
                // self.setModifierDefaults()

                self.nanobar.go(90)

                // load url encoded attributes, this lets us share humans
                self.human.io.fromUrl()

                self.nanobar.go(100)

            })
        });
    }

    App.prototype.setHumanDefaults = function(gender, barcode){
        // var randomPose = _.sample(['standing01', 'standing02', 'standing03', 'standing04', 'standing05'])
        var randomPose = 'standing02'
        console.log(randomPose)
        this.human.setPose(randomPose)

        console.log("setHumanDefaults gender = "+ gender);

        // add some default clothes
        var dress = 0 == gender ? 'F_Dbarcoderess_01' : 'male_casualsuit04'
        var  dress = barcode
        console.log("dress = "+ dress);
        console.log("barcode = "+ barcode);
        this.human.proxies.toggleProxy(dress, true)
        this.human.proxies.toggleProxy('eyebrow001',true)
        this.human.proxies.toggleProxy('Eyelashes01',true)
        var hair = 0 == gender ? 'Braid01' : 'short02'
        this.human.proxies.toggleProxy(hair,true)
        this.human.proxies.toggleProxy('data/proxies/eyes/Low-Poly/Low-Poly.json#brown',true)

        // lets set the color to be a mixed/average skin color
        this.human.mesh.material.materials[0].color = new THREE.Color(0.6451834425332652, 0.541358126188251, 0.46583313890034395)
    }

    App.prototype.getHeightValue = function(height){
        if (137 >= height) return 0;
        else if (198 <= height) return 1;
        return (height - 137) * 0.0164;
    }

    App.prototype.getWeightValue = function(weight){
        if (55 >= weight) return 0;
        else if (105 <= weight) return 1;
        return (weight - 55) * 0.02;
    }

    App.prototype.setModifierDefaults = function (gender, height, weight) {
        // this.human.modifiers.children['macrodetails/Gender'].setValue(0)
        // this.human.modifiers.children['macrodetails-proportions/BodyProportions'].setValue(1)
        // this.human.modifiers.children['macrodetails-height/Height'].setValue(0.5)

        // console.log("setModifierDefaults gender = "+ gender);
        // console.log("setModifierDefaults weight = "+ weight);
        // console.log("setModifierDefaults height = "+ height);

        // set some modifier buttons
        var heightvalue = self.getHeightValue(height)
        var weightvalue = self.getWeightValue(weight)
        // var heightvalue = 0.5
        // var weightvalue = 0.5
        console.log("setModifierDefaults heightvalue = "+ heightvalue);
        console.log("setModifierDefaults weightvalue = "+ weightvalue);
        var macroControllers = this.gui.gui.__folders.Modifiers.__folders["Macro modelling"].__folders.Macro.__controllers
        macroControllers.find(c=>c.property=="Gender").setValue(gender)
        macroControllers.find(c=>c.property=="Height").setValue(heightvalue)
        macroControllers.find(c=>c.property=="Weight").setValue(weightvalue)
        macroControllers.find(c=>c.property=="African").setValue(0)
        macroControllers.find(c=>c.property=="Muscle").setValue(0.25)
        macroControllers.find(c=>c.property=="Proportions").setValue(1)
    }

    App.prototype.onWindowResize = function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth * 4 / 5, window.innerHeight * 4 / 5);
    }

    // everything to update
    App.prototype.animate = function() {

        requestAnimationFrame(this.animate.bind(this));

        this.controls.update();

        this.render();
    }

    App.prototype.render = function() {
        var delta = 0.75 * this.clock.getDelta();
        this.stats.update();
        if (this.renderer && this.scene && this.camera && this.human) {
            // you need the before and after call to update the body
            this.human.onBeforeRender()
            this.renderer.render(this.scene, this.camera)
            this.human.onAfterRender()
        }
    }
    

    /**
     * Builds a simple interface to makehuman-js using dat.gui
     * see: https://workshop.chromeexperiments.com/examples/gui
     * @param       {App} app - instance of App
     * @constructor
     */
    function GUI(app){
        this.app = app
        this.human = app.human

        /** start controls */
        this.gui = new dat.GUI({
            // load: JSON
        });

        // This removes the side bar
        // dat.GUI.toggleHide();

        this.setupModifiersGUI();
        this.setupPoseGUI();
        this.setupProxyGUI();
        this.setupSkinGUI();
        this.setupBodyPartGUI();
        this.setupIOGUI();

        this.gui.width = 300;
        this.gui.open();
        this.gui.__folders.Modifiers.__folders["Macro modelling"].open()
        this.gui.__folders.Modifiers.__folders["Macro modelling"].__folders.Macro.open()

    }

    /** Set up modifier controls using dat-gui **/
    GUI.prototype.setupModifiersGUI = function() {
        var self = this;
        var modifierName;

        var guiGroups = {};
        var modifiers = self.human.modifiers.children;
        var modifierGui = this.gui.addFolder("Modifiers");

        this.modifierConfig = {};
        this.gui.remember(this.modifierConfig);

        /** sort them into basic groups for now **/
        for (var group in this.app.modeling_sliders) {
            if (this.app.modeling_sliders.hasOwnProperty(group)) {
                var groupData = this.app.modeling_sliders[group].modifiers;

                // make the group
                if (!guiGroups[group]) {
                    var folder = modifierGui.addFolder(group);
                    guiGroups[group] = {
                        folder: folder,
                        group: group,
                        subgroups: {}
                    };
                }

                for (var subgroup in groupData) {
                    if (groupData.hasOwnProperty(subgroup)) {
                        var subgroupData = this.app.modeling_sliders[group].modifiers[subgroup];
                        var cameraView = this.app.modeling_sliders[group].cameraView;

                        // make subgroups
                        if (!guiGroups[group].subgroups[subgroup]) {
                            var _folder = guiGroups[group].folder.addFolder(subgroup);
                            guiGroups[group].subgroups[subgroup] = {
                                folder: _folder,
                                group: subgroup,
                                subgroups: [],
                                cameraView: cameraView
                            };
                        }
                        var guiFolder = guiGroups[group].subgroups[subgroup].folder;

                        for (var i = 0; i < subgroupData.length; i++) {
                            var slider = subgroupData[i];
                            var modifier = self.human.modifiers.children[slider.mod];
                            var label = slider.label || modifier.name;
                            var defaultValue = modifier.defaultValue;
                            var min = modifier.min;
                            var max = modifier.max;
                            var step = (max - min) / 100;

                            modifier.label = label;
                            modifier.cam = slider.cam;

                            self.modifierConfig[label] = defaultValue ;

                            var modController = guiFolder.add(self.modifierConfig, label);
                            modController.min(min).max(max).step(step
                            ).onChange(modifier.setValue.bind(modifier)).onFinishChange(function(newValue) {
                                modifier.updateValue();
                                self.modifierConfig[modifier.name] = modifier.getValue();
                            }.bind(self));
                            modController.listen();
                            self.modifierConfig[label] = defaultValue;
                        }
                    }
                }
            }
        }

        // also lets add a randomize button
        this.randomizeModifiers = function() {
            self.human.modifiers.randomize();

            var modifiers = self.human.modifiers.children;
            for (var name in modifiers) {
                if (modifiers.hasOwnProperty(name)) {
                    // set defaults
                    var _modifier = modifiers[name];
                    self.modifierConfig[_modifier.name] = _modifier.getValue();
                }
            }
            // also randomise pose and wardrobe?
        };
        modifierGui.add(this, 'randomizeModifiers');

        this.resetModifiers = function() {
            self.human.modifiers.reset();

            var modifiers = self.human.modifiers.children;
            for (var name in modifiers) {
                if (modifiers.hasOwnProperty(name)) {
                    // set defaults
                    var _modifier2 = modifiers[name];
                    self.modifierConfig[_modifier2.name] = _modifier2.getValue();
                }
            }
        };
        modifierGui.add(this, 'resetModifiers');

        modifierGui.open();
    }
    
    GUI.prototype.setupIOGUI = function () {
        this.downloadObj = function() {
            // Uses FileSaver.js/1.3.3
            saveAs(
                new Blob( [self.human.io.toObj()], {type : 'text/plain;charset=utf-8'} ),
                    'test.obj'
                );
            };
        this.gui.add(this, 'downloadObj');
    }

    GUI.prototype.setupProxyGUI = function () {
        var self = this;
        this.proxyConfig = {}
        var proxiesbyGroup = _.groupBy(this.human.proxies.children, p=>p.group)
        var proxyGui = this.gui.addFolder("Wardrobe");
        var groups = Object.keys(proxiesbyGroup)
        groups.map(group=>{
            var proxyNames = proxiesbyGroup[group].map(p=>p.name)
            if (group=="clothes"){
                // dat-gui checkbox fields
                var proxyGroupGui = proxyGui.addFolder(group);
                this.proxyConfig[group] = proxiesbyGroup[group].reduce((o,p)=>{o[p.name]=p.visible;return o}, {})
                proxyNames.map((proxyName) => {
                    proxyGroupGui.add(this.proxyConfig[group], proxyName).onChange(function(state) {
                        self.human.proxies.toggleProxy(proxyName, state)
                    })
                })
            } else {
                // dat-gui select field
                var activeProxy =  proxiesbyGroup[group].find(p=>p.visible)
                this.proxyConfig[group] = activeProxy ? activeProxy.name: ''
                proxyGui.add(this.proxyConfig, group, proxyNames).onChange(function(proxyName) {
                    proxiesbyGroup[group].map(proxy => self.human.proxies.toggleProxy(proxy.name, false))
                    self.human.proxies.toggleProxy(proxyName, true)
                });
            }
            proxiesbyGroup[group]
        })
        this.gui.remember(this.poseConfig);
        proxyGui.open()
    }

    GUI.prototype.setupPoseGUI = function () {
        var self = this;
        var poseNames = Object.keys(this.human.poses)
        var poseGui = this.gui//.addFolder("Poses");
        this.poseConfig = {
            Pose: 'standing04'
        };
        this.gui.remember(this.poseConfig);
        this.gui.add(self.poseConfig, 'Pose', poseNames).onChange(function(pose) {
            self.human.setPose(pose)
        });

    }

    /** Set up controls using dat-gui **/
    GUI.prototype.setupSkinGUI = function() {
        var self = this;
        var skinNames = this.app.resources.skins

        this.skinConfig = {
            Skin: skinNames[0]
        };
        this.gui.remember(this.skinConfig);

        this.gui.add(self.skinConfig, 'Skin', skinNames).onChange(function(skin) {
            self.human.setSkin(skin);
        });
    }

    /** Set up a dat-gui panel to change opacity of parts of the body mesh **/
    GUI.prototype.setupBodyPartGUI = function() {
        var self = this;
        var bodyPart;

        var bodyPartGui = this.gui.addFolder("BodyParts");
        var bodyPartNames = _.map(this.human.mesh.material.materials, 'name');

        this.bodyPartConfig = {};
        for (var i = 0; i < bodyPartNames.length; i++) {
            bodyPart = bodyPartNames[i];
            this.bodyPartConfig[bodyPart] = 0;
        }
        var bodyName = Object.keys(this.bodyPartConfig)[0]
        this.bodyPartConfig[bodyName] = 1;

        this.gui.remember(this.bodyPartConfig);

        for (var k = 0; k < bodyPartNames.length; k++) {
            bodyPart = bodyPartNames[k];
            bodyPartGui.add(this.bodyPartConfig, bodyPart).max(1).min(0).step(0.1).onChange(function(o) {
                // var o = this.bodyPartConfig[bodyPart];
                self.human.bodyPartOpacity(o, this.property);
            });
        }

        this.bodyPartConfig = {};
        for (var j = 0; j < bodyPartNames.length; j++) {
            bodyPart = bodyPartNames[j];
            this.bodyPartConfig[bodyPart] = 0.0;
        }
        this.bodyPartConfig['body'] = 1;
        this.bodyPartConfig[self.human.mesh.material.materials[0].name] = 1;
    }

    return App;
}(makehuman, dat, _, THREE, Detector, Nanobar, Stats);