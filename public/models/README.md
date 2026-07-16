# 角色模型资源

## QuaterniusAnimationLibrary.gltf

- 来源：Quaternius Universal Animation Library（通过公开镜像仓库获取）
- 原始地址：`https://quaternius.itch.io/universal-animation-library`
- 下载镜像：`https://github.com/J-Ponzo/gltf-universal-animation-library`
- 授权：CC0 1.0
- 作者署名：Quaternius
- 配套文件：`AnimationLibrary_Godot_Standard.bin`
- 用途：玩家角色骨骼和完整战斗动作

当前接入的动作包括 `Idle_Loop`、`Walk_Loop`、`Jog_Fwd_Loop`、`Sword_Attack`、`Hit_Chest`、`Death01` 和 `Roll`。游戏状态别名会自动匹配这些名称；如果后续模型缺少某个动作，则由运行时骨骼姿态回退层补全。

## Xbot.glb

- 来源：Babylon.js 官方 Assets 仓库
- 原始地址：`https://github.com/BabylonJS/Assets/blob/master/meshes/Xbot.glb`
- 授权：Creative Commons Attribution 4.0 International（CC BY 4.0）
- 署名：Babylon.js Assets contributors
- 用途：Quaternius 资源加载失败时的程序化模型/基础动作回退
